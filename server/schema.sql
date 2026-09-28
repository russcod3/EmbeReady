-- ══════════════════════════════════════════════════════════════════════════════
-- EmbeReady — SQLite Schema
-- Encoding: UTF-8  |  Journal Mode: WAL (set in db.js)
-- All seed/demo records carry is_demo = 1 so they are clearly labeled in the UI.
-- ══════════════════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── Barangays ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barangays (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    name                    TEXT    NOT NULL UNIQUE,        -- e.g. "Brgy. 7 (Poblacion)"
    classification          TEXT    NOT NULL DEFAULT 'urban',
                                -- urban | coastal | industrial | upland | transit
    center_lat              REAL    NOT NULL,
    center_lng              REAL    NOT NULL,
    evacuation_center_name  TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Hazards ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hazards (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_code            TEXT    NOT NULL UNIQUE,            -- e.g. HZ-0001
    title               TEXT    NOT NULL,
    barangay_id         INTEGER NOT NULL REFERENCES barangays(id),
    category            TEXT    NOT NULL,
                            -- faulty_wiring | lpg_storage | dry_grass | overloaded_outlets
                            -- blocked_exit | illegal_burning | informal_settlement
                            -- flammable_storage | other
    risk_level          TEXT    NOT NULL DEFAULT 'moderate',-- low | moderate | heavy
    status              TEXT    NOT NULL DEFAULT 'potential',
                            -- potential | active | contained | resolved
    lat                 REAL    NOT NULL,
    lng                 REAL    NOT NULL,
    address             TEXT,
    description         TEXT,
    photo_url           TEXT,                               -- relative path or null
    is_demo             INTEGER NOT NULL DEFAULT 0,         -- 1 = seeded demo data
    active_started_at   TEXT,                               -- ISO datetime if status=active
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Risk Assessments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_assessments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    hazard_id           INTEGER NOT NULL REFERENCES hazards(id) ON DELETE CASCADE,
    overall_score       INTEGER NOT NULL DEFAULT 0,         -- 0–100
    assessed_level      TEXT    NOT NULL DEFAULT 'low',     -- low | moderate | heavy
    -- factors_json: {ignition, fuel, proximity, structure, truck_access,
    --                fire_history, weather, human_behavior}
    -- Each factor: {score, max_score, reason}
    factors_json        TEXT    NOT NULL DEFAULT '{}',
    confidence_level    TEXT    NOT NULL DEFAULT 'medium',  -- low | medium | high
    reasoning_summary   TEXT,
    engine              TEXT    NOT NULL DEFAULT 'rule_based',-- rule_based | llm
    model_version       TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Preparedness Plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preparedness_plans (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    hazard_id               INTEGER NOT NULL REFERENCES hazards(id) ON DELETE CASCADE,
    before_steps_json       TEXT    NOT NULL DEFAULT '[]',
    during_steps_json       TEXT    NOT NULL DEFAULT '[]',
    after_steps_json        TEXT    NOT NULL DEFAULT '[]',
    evacuation_tips_json    TEXT    NOT NULL DEFAULT '[]',
    prohibited_actions_json TEXT    NOT NULL DEFAULT '[]',
    local_context_notes     TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Fire History ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hazard_id       INTEGER REFERENCES hazards(id) ON DELETE SET NULL,
    barangay_id     INTEGER REFERENCES barangays(id),
    incident_name   TEXT    NOT NULL,
    incident_year   INTEGER,
    severity        TEXT    DEFAULT 'moderate',             -- low | moderate | heavy
    damage_notes    TEXT,
    lat             REAL,
    lng             REAL,
    is_demo         INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Reports (user-submitted) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_number          TEXT    NOT NULL UNIQUE,            -- ER-YYYYMMDD-XXXX
    hazard_id           INTEGER REFERENCES hazards(id),     -- created on accept
    reporter_ip_hash    TEXT,                               -- SHA-256 of IP, not raw
    honeypot_triggered  INTEGER NOT NULL DEFAULT 0,
    reported_level      TEXT,                               -- reporter's own assessment
    selected_action     TEXT    DEFAULT 'none',             -- barangay | bfp | none
    action_logged_at    TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Emergency Contacts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    jurisdiction    TEXT    NOT NULL,   -- "Citywide" or barangay name
    agency_type     TEXT    NOT NULL,   -- BFP | Barangay | Hospital | Police | National
    facility_name   TEXT    NOT NULL,
    phone_display   TEXT    NOT NULL,   -- shown in UI
    phone_dialable  TEXT,               -- tel: link value (digits + hyphens)
    is_placeholder  INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 100
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hazards_barangay   ON hazards(barangay_id);
CREATE INDEX IF NOT EXISTS idx_hazards_status     ON hazards(status);
CREATE INDEX IF NOT EXISTS idx_hazards_risk_level ON hazards(risk_level);
CREATE INDEX IF NOT EXISTS idx_assessments_hazard ON risk_assessments(hazard_id);
CREATE INDEX IF NOT EXISTS idx_plans_hazard       ON preparedness_plans(hazard_id);
CREATE INDEX IF NOT EXISTS idx_history_hazard     ON fire_history(hazard_id);
CREATE INDEX IF NOT EXISTS idx_history_barangay   ON fire_history(barangay_id);
CREATE INDEX IF NOT EXISTS idx_contacts_jurisdiction ON emergency_contacts(jurisdiction);
