'use strict';

const express = require('express');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const assessments = require('../assessment-service');

const router = express.Router();
const password = process.env.ADMIN_PASSWORD;
const passwordDigest = password?.length >= 8 ? digest(password) : null;
const sessionCookie = 'embeready_admin';
const sessionLifetime = 8 * 60 * 60 * 1000;
const sessions = new Map();
const decisions = ['validated', 'needs_verification', 'dismissed'];
const levels = ['low', 'moderate', 'heavy'];
const pageSize = 20;

function digest(value) {
    return createHash('sha256').update(value).digest();
}

function cookieOptions(req) {
    return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/api/admin' };
}

function fail(res, status, error) {
    return res.status(status).json({ success: false, error });
}

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!passwordDigest) return fail(res, 503, 'Set ADMIN_PASSWORD to at least 8 characters to enable report review.');
    // Cross-origin forms cannot send JSON, and the server grants no CORS access.
    if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) {
        return fail(res, 415, 'Send an application/json request.');
    }
    next();
});

router.post('/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, error: 'Too many sign-in attempts. Try again in 15 minutes.' }
}), (req, res) => {
    const candidate = req.body?.password;
    if (typeof candidate !== 'string' || candidate.length > 1024 ||
        !timingSafeEqual(digest(candidate), passwordDigest)) {
        return fail(res, 401, 'Incorrect admin password.');
    }

    const now = Date.now();
    for (const [token, expiry] of sessions) {
        if (expiry <= now) sessions.delete(token);
    }
    if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, now + sessionLifetime);
    res.cookie(sessionCookie, token, { ...cookieOptions(req), maxAge: sessionLifetime });
    res.json({ success: true });
});

router.use((req, res, next) => {
    const token = /(?:^|;\s*)embeready_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const expiry = sessions.get(token);
    if (!expiry || expiry <= Date.now()) {
        sessions.delete(token);
        return fail(res, 401, 'Sign in to review reports.');
    }
    req.adminToken = token;
    next();
});

router.post('/logout', (req, res) => {
    sessions.delete(req.adminToken);
    res.clearCookie(sessionCookie, cookieOptions(req));
    res.json({ success: true });
});

const reportJoins = `
    FROM reports r
    LEFT JOIN hazards h ON h.id = r.hazard_id
    LEFT JOIN barangays b ON b.id = h.barangay_id
    LEFT JOIN report_reviews v ON v.report_id = r.id
`;
const reportScope = `WHERE r.honeypot_triggered = 0 AND COALESCE(h.is_demo, 0) = 0`;
const reports = `${reportJoins} ${reportScope}`;
const summaryFields = `
    r.ref_number, r.reported_level, r.created_at,
    h.title, h.status AS incident_status, b.name AS barangay,
    COALESCE(v.decision, 'pending') AS decision
`;

router.get('/reports', (req, res) => {
    const { decision = 'all', q = '', page = '1' } = req.query;
    const pageNumber = Number(page);
    if (!['all', 'pending', ...decisions].includes(decision) || typeof q !== 'string' ||
        typeof page !== 'string' || !Number.isSafeInteger(pageNumber) || pageNumber < 1) {
        return fail(res, 400, 'Invalid report filters.');
    }

    const counts = { all: 0, pending: 0, needs_verification: 0, validated: 0, dismissed: 0 };
    const grouped = db.prepare(`SELECT COALESCE(v.decision, 'pending') AS decision, COUNT(*) AS total
        ${reports} GROUP BY COALESCE(v.decision, 'pending')`).all();
    for (const row of grouped) {
        counts[row.decision] = row.total;
        counts.all += row.total;
    }

    const query = q.trim().toLowerCase().slice(0, 120);
    const filters = `AND (? = 'all' OR COALESCE(v.decision, 'pending') = ?)
        AND (instr(lower(r.ref_number), ?) > 0 OR instr(lower(COALESCE(h.title, '')), ?) > 0
             OR instr(lower(COALESCE(b.name, '')), ?) > 0)`;
    const params = [decision, decision, query, query, query];
    const { total } = db.prepare(`SELECT COUNT(*) AS total ${reports} ${filters}`).get(...params);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(pageNumber, pages);
    const data = db.prepare(`SELECT ${summaryFields} ${reports} ${filters}
        ORDER BY CASE WHEN h.status = 'active' THEN 0 ELSE 1 END, r.id DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, (currentPage - 1) * pageSize);

    res.json({ success: true, data, counts, page: currentPage, pages, total });
});

const reportDetail = db.prepare(`
    SELECT ${summaryFields}, r.id, r.hazard_id, h.category, h.description, h.address,
           h.lat, h.lng, h.photo_url, o.data_json AS observations_json,
           v.evaluated_level, v.notes, v.updated_at AS reviewed_at, COALESCE(v.version, 0) AS version
    ${reportJoins}
    LEFT JOIN hazard_observations o ON o.hazard_id = h.id
    ${reportScope} AND r.ref_number = ?
`);

router.get('/reports/:ref', (req, res) => {
    const report = reportDetail.get(req.params.ref);
    if (!report) return fail(res, 404, 'Report not found.');
    const { id, hazard_id, observations_json, ...data } = report;
    const assessment = hazard_id && assessments.detail(hazard_id);
    data.observations = observations_json ? JSON.parse(observations_json).fields : null;
    data.assessment = assessment?.assessment ?? null;
    data.ai_status = data.incident_status === 'active' ? 'not_requested' : assessment?.ai_status;
    res.json({ success: true, data });
});

const saveReview = db.prepare(`
    INSERT INTO report_reviews (report_id, decision, evaluated_level, notes, version)
    SELECT ?, ?, ?, ?, 1
    WHERE ? = 0 OR EXISTS (SELECT 1 FROM report_reviews WHERE report_id = ?)
    ON CONFLICT (report_id) DO UPDATE SET
        decision = excluded.decision, evaluated_level = excluded.evaluated_level,
        notes = excluded.notes, updated_at = datetime('now'), version = report_reviews.version + 1
    WHERE report_reviews.version = ?
    RETURNING decision, evaluated_level, notes, updated_at AS reviewed_at, version
`);

router.put('/reports/:ref', (req, res) => {
    const report = reportDetail.get(req.params.ref);
    if (!report) return fail(res, 404, 'Report not found.');

    const { decision, evaluated_level: level, notes, version } = req.body ?? {};
    if (!decisions.includes(decision) || (level !== null && !levels.includes(level)) ||
        typeof notes !== 'string' || notes.length > 2000 || !Number.isSafeInteger(version) || version < 0) {
        return fail(res, 400, 'Choose a valid decision and risk level, and keep notes under 2,000 characters.');
    }
    if (decision !== 'validated' && !notes.trim()) {
        return fail(res, 400, 'Add a note explaining why the report needs verification or was dismissed.');
    }

    const review = saveReview.get(report.id, decision, level, notes.trim(), version, report.id, version);
    if (!review) return fail(res, 409, 'This report was reviewed elsewhere. Copy any unsaved notes, then reopen the report before editing.');
    res.json({ success: true, data: review });
});

router.use((req, res) => fail(res, 404, 'Admin endpoint not found.'));

module.exports = router;
