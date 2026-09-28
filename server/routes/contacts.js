/**
 * server/routes/contacts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/contacts           — all emergency contacts
 * GET /api/contacts/:barangay — contacts for a specific barangay + citywide
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT * FROM emergency_contacts ORDER BY sort_order ASC, jurisdiction ASC
        `).all();
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

router.get('/:barangay', (req, res) => {
    const jurisdiction = decodeURIComponent(req.params.barangay);
    try {
        const rows = db.prepare(`
            SELECT * FROM emergency_contacts
            WHERE jurisdiction = 'Citywide' OR jurisdiction = ?
            ORDER BY sort_order ASC
        `).all(jurisdiction);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
