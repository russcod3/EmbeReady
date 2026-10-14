/**
 * server/routes/reports.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/reports  — accept a new community hazard report
 * GET  /api/reports/:ref — lookup a report by reference number
 *
 * Anti-spam measures:
 *   1. IP-based rate limiting (configured in index.js via express-rate-limit)
 *   2. Honeypot field: if req.body.website is non-empty, reject silently
 *   3. Bounding box validation: coordinates must be within Batangas City
 *
 * File upload: handled by multer (photo, max 5 MB, jpg/png/webp only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express   = require('express');
const crypto    = require('crypto');
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const rateLimit = require('express-rate-limit');
const db        = require('../db');
const ai        = require('../ai');
const router    = express.Router();

// ── Rate limiter for new report submissions only ─────────────────────────────
const reportLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX       || '5',      10),
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
        success: false,
        errors:  ['Too many reports submitted from this device. Please wait 15 minutes before trying again.']
    }
});

// ── Bounding box (Batangas City) ──────────────────────────────────────────────
const BOUNDS = { south: 13.60, north: 13.85, west: 120.93, east: 121.14 };

// ── Multer config ─────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'user');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) => {
        const ext  = MIME_TO_EXT[file.mimetype] || '.jpg';
        const name = `report-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
        cb(null, name);
    }
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB   = parseInt(process.env.MAX_UPLOAD_MB || '5', 10);

const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
        else cb(new Error(`Invalid file type. Allowed: JPG, PNG, WebP`));
    }
});

// ── Helper: validate image magic bytes (prevent spoofed MIME headers) ────────
function validateImageMagicBytes(filePath) {
    try {
        const buffer = Buffer.alloc(12);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 12, 0);
        fs.closeSync(fd);

        // JPEG: FF D8 FF
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
        // WebP: RIFF .... WEBP
        if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;

        return false;
    } catch {
        return false;
    }
}

// ── Helper: generate reference number ─────────────────────────────────────────
// Uses crypto.randomBytes for 16.7 M possibilities/day (vs 9000 previously)
function generateRef() {
    const now  = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `ER-${date}-${rand}`;
}

// ── Helper: hash IP ───────────────────────────────────────────────────────────
function hashIP(ip) {
    return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
}

// ── Helper: validate coordinates ──────────────────────────────────────────────
function inBounds(lat, lng) {
    return lat >= BOUNDS.south && lat <= BOUNDS.north &&
           lng >= BOUNDS.west  && lng <= BOUNDS.east;
}

// ── POST /api/reports ─────────────────────────────────────────────────────────
router.post('/', reportLimiter, upload.single('photo'), async (req, res) => {
    // 0. Verify magic bytes of uploaded file
    if (req.file && !validateImageMagicBytes(req.file.path)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, errors: ['Uploaded file is not a valid JPEG, PNG, or WebP image.'] });
    }

    // 1. Honeypot check (silent reject to not tip off bots)
    if (req.body.website && req.body.website.trim() !== '') {
        return res.json({ success: true, ref_number: generateRef(), honeypot: true });
    }

    // 2. Extract and validate fields
    const {
        title, category, risk_level, status, description,
        lat, lng, address, barangay_id
    } = req.body;

    const errors = [];
    if (!title || title.trim().length < 5)
        errors.push('Title must be at least 5 characters.');
    if (!category)
        errors.push('Category is required.');
    if (!risk_level || !['low','moderate','heavy'].includes(risk_level))
        errors.push('Valid risk level required (low / moderate / heavy).');
    if (!status || !['potential','active'].includes(status))
        errors.push('Status must be "potential" or "active".');

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
        errors.push('Valid coordinates are required.');
    } else if (!inBounds(parsedLat, parsedLng)) {
        errors.push('Location must be within Batangas City. EmbeReady currently covers Batangas City only.');
    }
    if (!barangay_id) errors.push('Barangay is required.');

    if (errors.length > 0) {
        // Clean up uploaded file if validation fails
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, errors });
    }

    // 3. Lookup barangay
    const barangay = db.prepare('SELECT * FROM barangays WHERE id = ?').get(barangay_id);
    if (!barangay) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ success: false, errors: ['Invalid barangay selected.'] });
    }

    // 4. Build photo URL
    const photo_url = req.file ? `/uploads/user/${req.file.filename}` : null;
    const ip_hash    = hashIP(req.ip);
    const active_started_at = status === 'active' ? new Date().toISOString() : null;

    // 5. Generate collision-resistant ref number (retry if UNIQUE constraint fires)
    let ref_number;
    const MAX_REF_RETRIES = 5;
    for (let i = 0; i < MAX_REF_RETRIES; i++) {
        ref_number = generateRef();
        const existing = db.prepare('SELECT 1 FROM hazards WHERE ref_code = ?').get(ref_number);
        if (!existing) break;
        if (i === MAX_REF_RETRIES - 1) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(500).json({ success: false, error: 'Unable to generate unique reference. Please try again.' });
        }
    }

    // 6. Insert hazard + report atomically (transaction prevents orphaned rows)
    let hazardId;
    try {
        db.runTransaction(() => {
            const result = db.prepare(`
                INSERT INTO hazards
                    (ref_code, title, barangay_id, category, risk_level, status,
                     lat, lng, address, description, photo_url, is_demo, active_started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            `).run(
                ref_number, title.trim(), barangay_id, category, risk_level, status,
                parsedLat, parsedLng, (address||'').trim(), (description||'').trim(),
                photo_url, active_started_at
            );
            // Number() cast: node:sqlite returns BigInt, better-sqlite3 returns Number
            hazardId = Number(result.lastInsertRowid);

            db.prepare(`
                INSERT INTO reports (ref_number, hazard_id, reporter_ip_hash, reported_level)
                VALUES (?, ?, ?, ?)
            `).run(ref_number, hazardId, ip_hash, risk_level);
        });
    } catch (err) {
        console.error('[POST /api/reports] DB insert failed:', err);
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(500).json({ success: false, error: 'Database error. Please try again.' });
    }

    // 7. Run AI assessment (outside transaction — non-blocking, failure still returns success)
    let aiResult = null;
    try {
        const reportData = { category, risk_level, status, description };
        aiResult = await ai.assessReport(reportData, barangay);

        // Save assessment
        db.prepare(`
            INSERT INTO risk_assessments
                (hazard_id, overall_score, assessed_level, factors_json,
                 confidence_level, reasoning_summary, engine, model_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            hazardId,
            aiResult.assessment.overall_score,
            aiResult.assessment.assessed_level,
            aiResult.assessment.factors_json,
            aiResult.assessment.confidence_level,
            aiResult.assessment.reasoning_summary,
            aiResult.assessment.engine,
            aiResult.assessment.model_version
        );

        // Save plan
        db.prepare(`
            INSERT INTO preparedness_plans
                (hazard_id, before_steps_json, during_steps_json, after_steps_json,
                 evacuation_tips_json, prohibited_actions_json, local_context_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            hazardId,
            aiResult.plan.before_steps_json,
            aiResult.plan.during_steps_json,
            aiResult.plan.after_steps_json,
            aiResult.plan.evacuation_tips_json,
            aiResult.plan.prohibited_actions_json,
            aiResult.plan.local_context_notes
        );
    } catch (err) {
        console.warn('[POST /api/reports] AI assessment failed (non-fatal):', err.message);
    }

    // 8. Fetch emergency contacts
    const contacts = db.prepare(`
        SELECT * FROM emergency_contacts
        WHERE jurisdiction = 'Citywide' OR jurisdiction = ?
        ORDER BY sort_order ASC
    `).all(barangay.name);

    res.status(201).json({
        success: true,
        ref_number,
        hazard_id: hazardId,
        ai_result: aiResult,
        contacts
    });
});

// ── POST /api/reports/:ref/action — log BFP or Barangay contact choice ────────
router.post('/:ref/action', (req, res) => {
    const { ref } = req.params;
    const { action } = req.body;
    if (!['bfp','barangay','none'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Invalid action.' });
    }
    try {
        db.prepare(`
            UPDATE reports SET selected_action = ?, action_logged_at = datetime('now')
            WHERE ref_number = ?
        `).run(action, ref);
        res.json({ success: true });
    } catch (err) {
        console.error('[POST /reports/:ref/action]', err);
        res.status(500).json({ success: false, error: 'Database error.' });
    }
});

// ── GET /api/reports/:ref ─────────────────────────────────────────────────────
router.get('/:ref', (req, res) => {
    try {
        const report = db.prepare('SELECT * FROM reports WHERE ref_number = ?').get(req.params.ref);
        if (!report) return res.status(404).json({ success: false, error: 'Report not found.' });
        res.json({ success: true, data: report });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Database error.' });
    }
});

module.exports = router;
