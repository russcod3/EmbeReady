'use strict';

const { createHash, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const deriveKey = promisify(scrypt);
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const sharedPassword = process.env.ADMIN_PASSWORD;
const sharedDigest = sharedPassword?.length >= 8 ? digest(sharedPassword) : null;
const sessionLifetime = 8 * 60 * 60 * 1000;
const sessions = new Map();
const hasEnabledAccounts = db.prepare('SELECT 1 FROM reviewer_accounts WHERE enabled = 1 LIMIT 1');
const accountEnabled = db.prepare('SELECT enabled FROM reviewer_accounts WHERE username = ?');
const accountByName = db.prepare('SELECT username, password_hash FROM reviewer_accounts WHERE username = ?');

function digest(value) {
    return createHash('sha256').update(value).digest();
}

function fail(res, status, error) {
    return res.status(status).json({ success: false, error });
}

function cookieOptions(req) {
    return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/api/admin' };
}

function usernameOf(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requireOwner(req, res, next) {
    if (!req.reviewer.owner) return fail(res, 403, 'Only the shared administrator can manage reviewer accounts.');
    next();
}

function installAdminAuth(router) {
    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (!sharedDigest && !hasEnabledAccounts.get()) {
            return fail(res, 503, 'Set ADMIN_PASSWORD to at least 8 characters to enable report review.');
        }
        // Cross-origin forms cannot send JSON, and this server grants no CORS access.
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
    }), async (req, res, next) => {
        try {
            const { username: rawName = '', password } = req.body ?? {};
            const username = usernameOf(rawName);
            if (typeof rawName !== 'string' || typeof password !== 'string' || password.length > 1024) {
                return fail(res, 401, 'Incorrect username or password.');
            }
            let reviewer;
            if (!username) {
                if (sharedDigest && timingSafeEqual(digest(password), sharedDigest)) {
                    reviewer = { username: 'Shared admin', owner: true };
                }
            } else {
                const account = usernamePattern.test(username) && accountByName.get(username);
                const [salt, stored] = account ? account.password_hash.split(':') : ['0'.repeat(32), '0'.repeat(64)];
                const key = await deriveKey(password, salt, 32);
                if (timingSafeEqual(key, Buffer.from(stored, 'hex')) && account && accountEnabled.get(username)?.enabled) {
                    reviewer = { username: account.username, owner: false };
                }
            }
            if (!reviewer) return fail(res, 401, 'Incorrect username or password.');

            const now = Date.now();
            for (const [token, session] of sessions) {
                if (session.expiry <= now) sessions.delete(token);
            }
            if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
            const token = randomBytes(32).toString('hex');
            sessions.set(token, { reviewer, expiry: now + sessionLifetime });
            res.cookie('embeready_admin', token, { ...cookieOptions(req), maxAge: sessionLifetime });
            res.json({ success: true, reviewer });
        } catch (err) {
            next(err);
        }
    });

    router.use((req, res, next) => {
        const token = /(?:^|;\s*)embeready_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        const session = sessions.get(token);
        if (!session || session.expiry <= Date.now() ||
            (!session.reviewer.owner && !accountEnabled.get(session.reviewer.username)?.enabled)) {
            sessions.delete(token);
            return fail(res, 401, 'Sign in to review reports.');
        }
        req.adminToken = token;
        req.reviewer = session.reviewer;
        next();
    });

    router.post('/logout', (req, res) => {
        sessions.delete(req.adminToken);
        res.clearCookie('embeready_admin', cookieOptions(req));
        res.json({ success: true });
    });

    router.get('/reviewers', requireOwner, (req, res) => {
        const data = db.prepare('SELECT username, enabled FROM reviewer_accounts ORDER BY username').all();
        res.json({ success: true, data });
    });

    router.post('/reviewers', requireOwner, async (req, res, next) => {
        try {
            const username = usernameOf(req.body?.username);
            const password = req.body?.password;
            if (!usernamePattern.test(username) || typeof password !== 'string' || password.length < 8 || password.length > 1024) {
                return fail(res, 400, 'Use a 3–32 character username with letters, digits, dots, underscores, or hyphens, and a password of at least 8 characters.');
            }
            const salt = randomBytes(16).toString('hex');
            const key = await deriveKey(password, salt, 32);
            const inserted = db.prepare(`
                INSERT INTO reviewer_accounts (username, password_hash) VALUES (?, ?)
                ON CONFLICT (username) DO NOTHING
            `).run(username, salt + ':' + key.toString('hex'));
            if (!inserted.changes) return fail(res, 409, 'That username is already in use.');
            res.status(201).json({ success: true });
        } catch (err) {
            next(err);
        }
    });

    router.put('/reviewers/:username', requireOwner, (req, res) => {
        const { enabled } = req.body ?? {};
        if (typeof enabled !== 'boolean') return fail(res, 400, 'Choose whether the reviewer can sign in.');
        const username = usernameOf(req.params.username);
        const result = db.prepare('UPDATE reviewer_accounts SET enabled = ? WHERE username = ?').run(Number(enabled), username);
        if (!result.changes) return fail(res, 404, 'Reviewer not found.');
        if (!enabled) {
            for (const [token, session] of sessions) {
                if (session.reviewer.username === username) sessions.delete(token);
            }
        }
        res.json({ success: true });
    });
}

module.exports = { installAdminAuth, fail };
