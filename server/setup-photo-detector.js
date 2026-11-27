'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const model = require('./photo-detector-model.json');
const root = path.resolve(__dirname, '../data/models', model.directory);

async function setup() {
    for (const file of model.files) {
        const destination = path.resolve(root, file.name);
        if (!destination.startsWith(root + path.sep)) throw new Error('Invalid model destination.');
        if (fs.existsSync(destination) && (!file.sha256 || crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex') === file.sha256)) continue;
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        console.log('Downloading local detector: ' + file.name);
        const response = await fetch(`https://huggingface.co/${model.name}/resolve/${model.revision}/${file.name}`, { signal: AbortSignal.timeout(180000) });
        if (!response.ok) throw new Error('Model download returned HTTP ' + response.status);
        const partial = destination + '.partial';
        const hash = crypto.createHash('sha256');
        let bytes = 0, nextProgress = 10 * 1024 * 1024;
        try {
            await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, _, callback) {
                hash.update(chunk); bytes += chunk.length;
                if (bytes >= nextProgress) { console.log(Math.round(bytes / 1024 / 1024) + ' MB downloaded'); nextProgress += 10 * 1024 * 1024; }
                callback(null, chunk);
            } }), fs.createWriteStream(partial));
            if (file.sha256 && hash.digest('hex') !== file.sha256) throw new Error('Model checksum did not match.');
            fs.renameSync(partial, destination);
        } catch (error) {
            if (fs.existsSync(partial)) fs.unlinkSync(partial);
            throw error;
        }
    }
    fs.writeFileSync(path.join(root, 'SOURCE.json'), JSON.stringify(model, null, 2));
    console.log('Local photo detector installed. Photos stay on this server; no API key is used.');
}
if (require.main === module) setup().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { setup, root };
