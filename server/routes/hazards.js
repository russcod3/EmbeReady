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

    sql += ` ORDER BY
        CASE h.status WHEN 'active' THEN 0 WHEN 'potential' THEN 1 WHEN 'contained' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END,
        CASE h.risk_level WHEN 'heavy' THEN 0 WHEN 'moderate' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
        h.updated_at DESC`;

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

// Curated real-world Batangas City landmarks (matches Google Maps ground truth)
const BATANGAS_LANDMARKS = [
    { name: 'Batangas State University - Alangilan Campus', lat: 13.7841, lng: 121.0743, type: 'University', barangay_name: 'Alangilan' },
    { name: 'Batangas State University - Pablo Borbon (Main)', lat: 13.7543, lng: 121.0549, type: 'University', barangay_name: 'Brgy. 1 (Poblacion)' },
    { name: 'Batangas City Grand Terminal', lat: 13.7898, lng: 121.0623, type: 'Terminal', barangay_name: 'Bolbok' },
    { name: 'Batangas Port (Passenger & Cargo Terminal)', lat: 13.7552, lng: 121.0440, type: 'Port', barangay_name: 'Santa Clara' },
    { name: 'SM City Batangas', lat: 13.7505, lng: 121.0515, type: 'Commercial', barangay_name: 'Pallocan West' },
    { name: 'Batangas Medical Center (BatMC)', lat: 13.7670, lng: 121.0668, type: 'Hospital', barangay_name: 'Kumintang Ibaba' },
    { name: 'St. Patrick\'s Hospital Medical Center', lat: 13.7556, lng: 121.0603, type: 'Hospital', barangay_name: 'Brgy. 3 (Poblacion)' },
    { name: 'United Doctors of St. Camillus de Lellis Hospital', lat: 13.7821, lng: 121.0559, type: 'Hospital', barangay_name: 'Bolbok' },
    { name: 'Batangas City Hall / Plaza Mabini', lat: 13.7559, lng: 121.0592, type: 'Government', barangay_name: 'Brgy. 1 (Poblacion)' },
    { name: 'Batangas Provincial Capitol', lat: 13.7617, lng: 121.0528, type: 'Government', barangay_name: 'Kumintang Ibaba' },
    { name: 'BFP Batangas City Central Fire Station', lat: 13.7562, lng: 121.0590, type: 'Fire Station', barangay_name: 'Brgy. 1 (Poblacion)' },
    { name: 'Batangas Sports Coliseum', lat: 13.7715, lng: 121.0535, type: 'Sports', barangay_name: 'Bolbok' },
    { name: 'Batangas Diversion Road', lat: 13.7750, lng: 121.0550, type: 'Highway', barangay_name: 'Bolbok / Alangilan' }
];

// ── Helper: escape LIKE pattern wildcards (%, _) ─────────────────────────────
function escapeLike(str) {
    return str.replace(/[%_\\]/g, '\\$&');
}

// ── GET /api/geocode — offline barangay & landmark search ──────────────────────
router.get('/meta/geocode', (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ success: true, data: [] });
    const qEsc = escapeLike(q);

    try {
        // 1. Match official barangays by name (highest priority)
        const barangays = db.prepare(`
            SELECT name, center_lat AS lat, center_lng AS lng, 'Barangay' AS type
            FROM barangays
            WHERE lower(name) LIKE ? ESCAPE '\\'
            ORDER BY
                CASE WHEN lower(name) = ? THEN 1
                     WHEN lower(name) LIKE ? ESCAPE '\\' THEN 2
                     ELSE 3 END,
                name ASC
            LIMIT 5
        `).all(`%${qEsc}%`, q, `${qEsc}%`);

        // 2. Match curated Batangas City landmarks (schools, terminals, hospitals)
        const matchedLandmarks = BATANGAS_LANDMARKS.filter(lm =>
            lm.name.toLowerCase().includes(q) || lm.barangay_name.toLowerCase().includes(q)
        ).slice(0, 3);

        // 3. Match evacuation sites
        const evacCenters = db.prepare(`
            SELECT evacuation_center_name AS name, center_lat AS lat, center_lng AS lng, 'Evacuation Site' AS type, name AS barangay_name
            FROM barangays
            WHERE lower(evacuation_center_name) LIKE ? ESCAPE '\\' AND evacuation_center_name IS NOT NULL
            LIMIT 2
        `).all(`%${qEsc}%`);

        // 4. Only search hazards if the user explicitly types hazard keywords (e.g. fire, wiring, lpg)
        const isHazardKeyword = ['fire', 'sunog', 'wiring', 'lpg', 'grass', 'burning', 'outlets', 'chemical'].some(k => q.includes(k));
        let hazards = [];
        if (isHazardKeyword) {
            hazards = db.prepare(`
                SELECT h.title AS name, h.lat, h.lng, 'Hazard' AS type, b.name AS barangay_name
                FROM hazards h JOIN barangays b ON h.barangay_id = b.id
                WHERE lower(h.title) LIKE ? ESCAPE '\\'
                LIMIT 2
            `).all(`%${qEsc}%`);
        }

        res.json({ success: true, data: [...barangays, ...matchedLandmarks, ...evacCenters, ...hazards] });
    } catch (err) {
        console.error('[GET /api/geocode]', err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
