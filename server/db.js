/**
 * server/db.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite connection singleton using better-sqlite3.
 * WAL mode is enabled for concurrent reads alongside writes.
 * The schema is applied on first run (idempotent CREATE IF NOT EXISTS).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'embeready.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Open (or create) the database file
const db = new Database(DB_PATH);

// Performance and reliability pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -8000');   // 8 MB page cache

// Apply schema (CREATE TABLE IF NOT EXISTS — safe to run every startup)
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSql);

console.log(`[DB] Connected → ${DB_PATH}`);

module.exports = db;
