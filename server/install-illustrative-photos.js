'use strict';
// Explicit, idempotent installation. Never imports db.js or requests assessments.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ quiet: true });
const { DatabaseSync } = require('node:sqlite');
const manifest = require('./data/hazard-photo-manifest.json');
const databasePath = process.env.DB_PATH || path.join(__dirname, '../data/embeready.db');
const publicRoot = path.resolve(__dirname, '../public');
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA busy_timeout=5000');
const find = db.prepare('SELECT id,photo_url FROM hazards WHERE ref_code=?');
const update = db.prepare('UPDATE hazards SET photo_url=? WHERE id=?');
let installed=0, preserved=0;
db.exec('BEGIN IMMEDIATE');
try {
    for (const entry of manifest) {
        const row = find.get(entry.reference);
        if (!row) continue;
        if (!/^\/uploads\/seed\/[a-zA-Z0-9._-]+$/.test(entry.photo_url)) throw new Error('Invalid illustration path');
        const file = path.resolve(publicRoot, '.' + entry.photo_url);
        if (!fs.existsSync(file)) throw new Error('Missing illustration for ' + entry.reference);
        const existing = row.photo_url && path.resolve(publicRoot, '.' + row.photo_url);
        if (row.photo_url !== entry.photo_url && !entry.replaces?.includes(row.photo_url) && existing && existing.startsWith(publicRoot+path.sep) && fs.existsSync(existing)) {
            preserved++;
            continue;
        }
        if (row.photo_url !== entry.photo_url) { update.run(entry.photo_url,row.id); installed++; }
    }
    db.exec('COMMIT');
} catch(error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
console.log(JSON.stringify({installed,preserved}));
