'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');
const model = require('./photo-detector-model.json');
const publicRoot = path.resolve(__dirname, '../public');
const uploadRoot = path.join(publicRoot, 'uploads/user');
let worker, sequence = 0;
const waiting = new Map();
let queue = Promise.resolve();
let queued = 0;

function photoFile(url, { userOnly = true } = {}) {
    if (typeof url !== 'string' || !(userOnly ? url.startsWith('/uploads/user/') : /^\/uploads\/(user|seed)\//.test(url))) return null;
    const root = userOnly ? uploadRoot : path.join(publicRoot, 'uploads');
    const file = path.resolve(publicRoot, '.' + url);
    if (!file.startsWith(root + path.sep) || !/\.(png|jpe?g|webp)$/i.test(file)) return null;
    try {
        const real = fs.realpathSync(file), stat = fs.statSync(real);
        if (!real.startsWith(fs.realpathSync(root) + path.sep) || !stat.isFile() || stat.size > 5 * 1024 * 1024) return null;
        return real;
    } catch { return null; }
}
function available() {
    return model.files.every(file => fs.existsSync(path.resolve(__dirname, '../data/models', model.directory, file.name)));
}
function signal(score) {
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) throw new Error('Invalid photo score.');
    return { ai_score: score, flagged: score > model.threshold, threshold: model.threshold, model: model.name, revision: model.revision };
}
function ensureWorker() {
    if (worker) return worker;
    const instance = new Worker(path.join(__dirname, 'photo-detector-worker.js'));
    worker = instance;
    instance.unref();
    instance.on('message', message => {
        const job = waiting.get(message.id);
        if (!job) return;
        waiting.delete(message.id); clearTimeout(job.timer);
        if (!waiting.size) instance.unref();
        if (message.error) job.reject(new Error(message.error)); else job.resolve(message.score);
    });
    const failed = error => {
        if (worker === instance) worker = null;
        for (const [id, job] of waiting) { clearTimeout(job.timer); job.reject(error); waiting.delete(id); }
    };
    instance.on('error', failed);
    instance.on('exit', code => { if (worker === instance) { worker = null; if (waiting.size) failed(new Error('Local photo scanner stopped (' + code + ').')); } });
    return instance;
}
async function infer(file) {
    if (!available()) throw Object.assign(new Error('Local photo scanner is not installed. Run npm run setup:detector.'), { code: 'SCANNER_NOT_INSTALLED' });
    if (queued >= 3) throw Object.assign(new Error('The photo scanner is busy. Try again shortly.'), { code: 'SCANNER_BUSY' });
    queued++;
    const task = queue.catch(() => {}).then(() => new Promise((resolve, reject) => {
        const instance = ensureWorker(), id = ++sequence;
        const timer = setTimeout(() => {
            waiting.delete(id);
            if (worker === instance) worker = null;
            instance.terminate();
            reject(new Error('The local photo check timed out. Try again.'));
        }, 90000);
        waiting.set(id, { resolve, reject, timer });
        instance.ref(); instance.postMessage({ id, file });
    }));
    queue = task;
    try { return signal(await task); } finally { queued--; }
}
async function scan(db, hazardId, run = infer) {
    const hazard = db.prepare('SELECT id, photo_url FROM hazards WHERE id = ?').get(hazardId);
    const file = photoFile(hazard?.photo_url);
    if (!file) throw Object.assign(new Error('A supported submitted photo is required for a scan.'), { code: 'PHOTO_UNAVAILABLE' });
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const cached = db.prepare('SELECT * FROM photo_authenticity_scans WHERE hazard_id = ? AND image_hash = ? AND model_revision = ?').get(hazardId, hash, model.revision);
    if (cached) return { ...signal(cached.ai_score), scanned_at: cached.scanned_at, cached: true };
    const result = signal((await run(file)).ai_score);
    const current = db.prepare('SELECT photo_url FROM hazards WHERE id = ?').get(hazardId);
    if (!current || current.photo_url !== hazard.photo_url || !fs.existsSync(file) || crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== hash) {
        throw Object.assign(new Error('The report or photo changed during scanning. Reopen it.'), { code: 'PHOTO_CHANGED' });
    }
    const saved = db.prepare(`INSERT INTO photo_authenticity_scans(hazard_id,image_hash,model_revision,ai_score)
        VALUES(?,?,?,?) ON CONFLICT(hazard_id) DO UPDATE SET image_hash=excluded.image_hash, model_revision=excluded.model_revision,
        ai_score=excluded.ai_score, scanned_at=datetime('now') RETURNING scanned_at`).get(hazardId, hash, model.revision, result.ai_score);
    return { ...result, scanned_at: saved.scanned_at, cached: false };
}
module.exports = { scan, infer, signal, available, photoFile, model };
