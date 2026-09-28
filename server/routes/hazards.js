/**
 * server/routes/hazards.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST endpoints for hazard data.
 *
 * GET  /api/hazards          — list hazards (filterable)
 * GET  /api/hazards/:id      — single hazard with full detail
 * GET  /api/barangays        — list all barangays
 * GET  /api/geocode          — offline barangay/hazard name search
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const db      = require('../db');
const router  = express.Router();

// ── GET /api/hazards ──────────────────────────────────────────────────────────
// Query params: status, risk_level, category, barangay_id, is_demo
router.get('/', (req, res) => {
    const { status, risk_level, category, barangay_id, is_demo, active_only } = req.query;

    let sql = `
        SELECT
            h.id, h.ref_code, h.title, h.category, h.risk_level, h.status,
            h.lat, h.lng, h.address, h.description, h.photo_url, h.is_demo,
            h.active_started_at, h.created_at, h.updated_at,
            b.name  AS barangay_name,
            b.classification AS barangay_classification,
            ra.overall_score, ra.assessed_level, ra.confidence_level, ra.engine
        FROM hazards h
        JOIN barangays b ON h.barangay_id = b.id
        LEFT JOIN risk_assessments ra ON ra.hazard_id = h.id
            AND ra.id = (
                SELECT id FROM risk_assessments
                WHERE hazard_id = h.id
                ORDER BY created_at DESC LIMIT 1
            )
        WHERE 1=1
    `;
    const params = [];

    if (active_only === '1' || active_only === 'true') {
        sql += ' AND h.status = ?';
        params.push('active');
    } else if (status) {
        sql += ' AND h.status = ?';
        params.push(status);
    }
    if (risk_level) { sql += ' AND h.risk_level = ?';  params.push(risk_level); }
    if (category)   { sql += ' AND h.category = ?';    params.push(category);   }
    if (barangay_id){ sql += ' AND h.barangay_id = ?'; params.push(barangay_id);}
    if (is_demo !== undefined) {
        sql += ' AND h.is_demo = ?';
        params.push(is_demo === '1' || is_demo === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY h.status DESC, h.risk_level DESC, h.updated_at DESC';

    try {
        const rows = db.prepare(sql).all(...params);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error('[GET /api/hazards]', err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ── GET /api/hazards/:id ──────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
    const { id } = req.params;
    try {
        // Main hazard record
        const hazard = db.prepare(`
            SELECT h.*, b.name AS barangay_name, b.classification AS barangay_classification,
                   b.center_lat AS barangay_lat, b.center_lng AS barangay_lng,
                   b.evacuation_center_name
            FROM hazards h
            JOIN barangays b ON h.barangay_id = b.id
            WHERE h.id = ?
        `).get(id);

        if (!hazard) return res.status(404).json({ success: false, error: 'Not found' });

        // Latest risk assessment
        const assessment = db.prepare(`
            SELECT * FROM risk_assessments
            WHERE hazard_id = ?
            ORDER BY created_at DESC LIMIT 1
        `).get(id);

        // Preparedness plan
        const plan = db.prepare(`
            SELECT * FROM preparedness_plans
            WHERE hazard_id = ?
            ORDER BY created_at DESC LIMIT 1
        `).get(id);

        // Fire history at this hazard or in the same barangay
        const history = db.prepare(`
            SELECT * FROM fire_history
            WHERE hazard_id = ? OR barangay_id = (
                SELECT barangay_id FROM hazards WHERE id = ?
            )
            ORDER BY incident_year DESC
            LIMIT 5
        `).all(id, id);

        // Emergency contacts for city + this barangay
        const contacts = db.prepare(`
            SELECT * FROM emergency_contacts
            WHERE jurisdiction = 'Citywide' OR jurisdiction = ?
            ORDER BY sort_order ASC
        `).all(hazard.barangay_name);

        // Parse JSON fields safely
        if (assessment?.factors_json) {
            try { assessment.factors = JSON.parse(assessment.factors_json); } catch { assessment.factors = {}; }
        }
        if (plan) {
            for (const field of ['before_steps_json','during_steps_json','after_steps_json','evacuation_tips_json','prohibited_actions_json']) {
                try { plan[field.replace('_json','')] = JSON.parse(plan[field]); } catch { plan[field.replace('_json','')] = []; }
            }
        }

        res.json({ success: true, data: { hazard, assessment, plan, history, contacts } });
    } catch (err) {
        console.error(`[GET /api/hazards/${id}]`, err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ── GET /api/barangays ────────────────────────────────────────────────────────
router.get('/meta/barangays', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM barangays ORDER BY name ASC').all();
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[GET /api/barangays]', err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ── GET /api/geocode — offline barangay/hazard search ─────────────────────────
router.get('/meta/geocode', (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ success: true, data: [] });

    try {
        // Match barangays by name
        const barangays = db.prepare(`
            SELECT name, center_lat AS lat, center_lng AS lng, 'barangay' AS type
            FROM barangays
            WHERE lower(name) LIKE ?
            LIMIT 5
        `).all(`%${q}%`);

        // Match hazard titles / addresses
        const hazards = db.prepare(`
            SELECT h.title AS name, h.lat, h.lng, 'hazard' AS type, b.name AS barangay_name
            FROM hazards h JOIN barangays b ON h.barangay_id = b.id
            WHERE lower(h.title) LIKE ? OR lower(h.address) LIKE ? OR lower(b.name) LIKE ?
            LIMIT 5
        `).all(`%${q}%`, `%${q}%`, `%${q}%`);

        res.json({ success: true, data: [...barangays, ...hazards] });
    } catch (err) {
        console.error('[GET /api/geocode]', err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
