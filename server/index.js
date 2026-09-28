/**
 * server/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Express application entry point.
 * Run with: npm start   (node server/index.js)
 *           npm run dev (nodemon server/index.js)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const hazardRoutes  = require('./routes/hazards');
const reportRoutes  = require('./routes/reports');
const contactRoutes = require('./routes/contacts');

// Initialize DB (runs schema on first start)
require('./db');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Trust proxy (for accurate IP rate limiting behind nginx/LAN) ──────────────
app.set('trust proxy', 1);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Rate limiter for report submissions ───────────────────────────────────────
const reportLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX       || '5',      10),
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
        success: false,
        error:   'Too many reports submitted from this device. Please wait 15 minutes before trying again.'
    }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/hazards',  hazardRoutes);
app.use('/api/reports',  reportLimiter, reportRoutes);
app.use('/api/contacts', contactRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status:    'ok',
        app:       'EmbeReady',
        city:      'Batangas City, Batangas, Philippines',
        timestamp: new Date().toISOString()
    });
});

// ── SPA fallback — serve index.html for all unmatched routes ──────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            error: `File too large. Maximum size is ${process.env.MAX_UPLOAD_MB || 5} MB.`
        });
    }
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({ success: false, error: err.message });
    }
    console.error('[Server Error]', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n┌──────────────────────────────────────────────────────┐`);
    console.log(`│  EmbeReady — Batangas City Fire Hazard & Risk Map    │`);
    console.log(`│  Server running at http://localhost:${PORT}               │`);
    console.log(`│  AI Provider: ${(process.env.AI_PROVIDER || 'none').padEnd(37)}│`);
    console.log(`└──────────────────────────────────────────────────────┘\n`);
});
