'use strict';
const { parentPort } = require('node:worker_threads');
const path = require('node:path');
const model = require('./photo-detector-model.json');
let classifier;

async function classify(file) {
    const { pipeline, env, RawImage } = await import('@huggingface/transformers');
    // Runtime inference is entirely local. Only setup-photo-detector downloads weights.
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = path.resolve(__dirname, '../data/models') + path.sep;
    classifier ??= await pipeline('image-classification', model.directory, {
        local_files_only: true, device: 'cpu', dtype: 'q8',
        session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 }
    });
    const sharp = require('sharp');
    // Decode untrusted uploads with a bounded pixel budget, then discard metadata.
    const { data, info } = await sharp(file, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const image = new RawImage(new Uint8ClampedArray(data), info.width, info.height, info.channels);
    const output = await classifier(image, { top_k: 2 });
    const fake = output.find(item => String(item.label).toUpperCase() === 'FAKE');
    if (!fake || !Number.isFinite(fake.score) || fake.score < 0 || fake.score > 1) throw new Error('The detector returned an invalid score.');
    return fake.score;
}
parentPort.on('message', async ({ id, file }) => {
    try { parentPort.postMessage({ id, score: await classify(file) }); }
    catch (error) { parentPort.postMessage({ id, error: error.message }); }
});
