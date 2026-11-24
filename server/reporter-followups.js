'use strict';

const express = require('express');
const { createHash, randomBytes } = require('node:crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const db = require('./db');
const { fail } = require('./admin-auth');
const { isWithinBatangas } = require('./report-validation');

const publicRouter = express.Router();
const tokenPattern = /^Bearer ([a-f0-9]{64})$/;
const lookup = db.prepare(`
    SELECT id, question, expires_at, replied_at, cancelled_at,
        expires_at <= datetime('now') AS expired
    FROM reporter_followups WHERE token_hash = ?
`);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 3, fieldSize: 3000, parts: 5 }
}).single('photo');

function hash(token) {
    return createHash('sha256').update(token).digest('hex');
}

function imageType(buffer) {
    if (buffer.length < 12) return null;
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
    return null;
}

publicRouter.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
}, rateLimit({
    windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Try again in 15 minutes.' }
}), (req, res, next) => {
    const token = tokenPattern.exec(req.get('Authorization') || '')?.[1];
    const request = token && lookup.get(hash(token));
    if (!request || request.cancelled_at || request.expired) return fail(res, 404, 'This private link is invalid or has expired.');
    req.followup = request;
    next();
});

publicRouter.get('/', (req, res) => {
    const { question, expires_at, replied_at } = req.followup;
    res.json({ success: true, data: { question, expires_at, submitted: Boolean(replied_at) } });
});

publicRouter.post('/', (req, res, next) => {
    if (req.followup.replied_at) return fail(res, 409, 'A reply was already submitted through this link.');
    if (!req.is('multipart/form-data')) return fail(res, 415, 'Submit the reply using the private form.');
    upload(req, res, error => {
        if (error instanceof multer.MulterError) return fail(res, 400, 'Submit one JPG, PNG, or WebP photo up to 3 MB and a short reply.');
        if (error) return fail(res, 400, 'The upload could not be read. Try submitting again.');
        try {
            const { reply = '', lat = '', lng = '' } = req.body ?? {};
            if (typeof reply !== 'string' || reply.length > 2000 || typeof lat !== 'string' || typeof lng !== 'string') {
                return fail(res, 400, 'Keep the reply under 2,000 characters and provide valid coordinates.');
            }
            const hasPin = Boolean(lat.trim() || lng.trim());
            const latitude = lat.trim() ? Number(lat) : NaN;
            const longitude = lng.trim() ? Number(lng) : NaN;
            if (hasPin && !isWithinBatangas(latitude, longitude)) return fail(res, 400, 'Enter both coordinates within Batangas City.');
            const bytes = req.file?.buffer ?? null;
            const mime = bytes ? imageType(bytes) : null;
            if (bytes && !mime) return fail(res, 400, 'Choose a JPG, PNG, or WebP photo.');
            if (!reply.trim() && !hasPin && !bytes) return fail(res, 400, 'Add a reply, coordinates, or a photo.');
            const result = db.prepare(`
                UPDATE reporter_followups SET reply = ?, reply_lat = ?, reply_lng = ?, photo_mime = ?,
                    photo = ?, replied_at = datetime('now')
                WHERE id = ? AND cancelled_at IS NULL AND expires_at > datetime('now') AND replied_at IS NULL
            `).run(reply.trim(), hasPin ? latitude : null, hasPin ? longitude : null, mime, bytes, req.followup.id);
            if (!result.changes) return fail(res, 409, 'This link has already been used, replaced, or expired.');
            res.status(201).json({ success: true });
        } catch (err) {
            next(err);
        }
    });
});

const list = db.prepare(`
    SELECT id, requested_by, question, requested_at, expires_at, cancelled_at, replied_at, reply, reply_lat,
           reply_lng, photo IS NOT NULL AS has_photo, read_at, expires_at <= datetime('now') AS expired
    FROM reporter_followups WHERE report_id = ? ORDER BY id DESC
`);

function installReporterFollowups(router, reportDetail) {
    router.get('/reports/:ref/reporter-requests', (req, res) => {
        const report = reportDetail.get(req.params.ref);
        if (!report) return fail(res, 404, 'Report not found.');
        res.json({ success: true, data: list.all(report.id) });
    });
    router.post('/reports/:ref/reporter-requests', (req, res) => {
        const report = reportDetail.get(req.params.ref);
        if (!report) return fail(res, 404, 'Report not found.');
        if (report.is_training) return fail(res, 400, 'Private reporter links are available for community reports.');
        const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
        if (!question || question.length > 1000) return fail(res, 400, 'Enter a question up to 1,000 characters.');
        const token = randomBytes(32).toString('hex');
        const data = db.runTransaction(() => {
            db.prepare(`
                UPDATE reporter_followups SET cancelled_at = datetime('now')
                WHERE report_id = ? AND replied_at IS NULL AND cancelled_at IS NULL AND expires_at > datetime('now')
            `).run(report.id);
            db.prepare(`
                INSERT INTO reporter_followups (report_id, token_hash, requested_by, question) VALUES (?, ?, ?, ?)
            `).run(report.id, hash(token), req.reviewer.username, question);
            return list.all(report.id);
        }, { immediate: true });
        res.status(201).json({ success: true, data, path: '/report-follow-up#' + token });
    });

    router.put('/reports/:ref/reporter-requests/:id', (req, res) => {
        const report = reportDetail.get(req.params.ref);
        if (!report) return fail(res, 404, 'Report not found.');
        const result = db.prepare(`
            UPDATE reporter_followups SET read_at = COALESCE(read_at, datetime('now'))
            WHERE id = ? AND report_id = ? AND replied_at IS NOT NULL
        `).run(req.params.id, report.id);
        if (!result.changes) return fail(res, 404, 'Reply not found.');
        res.json({ success: true, data: list.all(report.id) });
    });

    router.get('/reports/:ref/reporter-requests/:id/photo', (req, res) => {
        const report = reportDetail.get(req.params.ref);
        const photo = report && db.prepare('SELECT photo, photo_mime FROM reporter_followups WHERE id = ? AND report_id = ?')
            .get(req.params.id, report.id);
        if (!photo?.photo) return fail(res, 404, 'Photo not found.');
        res.set('Cross-Origin-Resource-Policy', 'same-origin');
        res.type(photo.photo_mime).send(Buffer.from(photo.photo));
    });
}

module.exports = { publicRouter, installReporterFollowups, list };
