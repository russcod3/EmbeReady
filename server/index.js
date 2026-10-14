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
// Only enable when actually behind a reverse proxy. Set TRUST_PROXY=1 in .env.
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || 1);
}

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://unpkg.com https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com",
        "connect-src 'self' https://nominatim.openstreetmap.org https://is-on-water.balbona.me",
        "frame-ancestors 'none'"
    ].join('; '));
    next();
});

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/hazards',  hazardRoutes);
app.use('/api/reports',  reportRoutes);
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
