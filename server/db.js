/**
 * server/db.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SQLite connection singleton.
 * Driver preference: node:sqlite (Node >= 22.5) → better-sqlite3 (fallback).
 * WAL mode is enabled for concurrent reads alongside writes.
 * The schema is applied on first run (idempotent CREATE IF NOT EXISTS).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const path    = require('path');
const fs      = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'embeready.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db;

// 1. Prefer Node.js built-in SQLite (Node >= 22.5.0 / Node 24+), requiring zero C++ build tools or external compilation
try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    if (!db.pragma) {
        db.pragma = function(pragmaStr) {
            try {
                return db.exec(`PRAGMA ${pragmaStr};`);
            } catch (err) {
                // Ignore pragma if not applicable
            }
        };
    }
} catch (e) {
    // 2. Fall back to better-sqlite3 if installed
    try {
        const Database = require('better-sqlite3');
        db = new Database(DB_PATH);
    } catch (err) {
        throw new Error(
            'No SQLite driver available. EmbeReady requires Node >= 22.5.0 (for built-in node:sqlite) or better-sqlite3.'
        );
    }
}

// Performance and reliability pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -8000');   // 8 MB page cache

// Apply schema (CREATE TABLE IF NOT EXISTS — safe to run every startup)
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSql);

// ── Transaction helper (works with node:sqlite & better-sqlite3) ─────────────
/**
 * runTransaction(fn) — wraps fn() in BEGIN/COMMIT with auto-ROLLBACK on error.
 * Use for multi-statement writes that must be atomic.
 * NOTE: Keep fn() synchronous — the write lock is held for the entire duration.
 */
db.runTransaction = function runTransaction(fn) {
    db.exec('BEGIN');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (err) {
        try { db.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
        throw err;
    }
};

console.log(`[DB] Connected → ${DB_PATH}`);

module.exports = db;
