/**
 * backend/src/db/index.js
 * SQLite database setup using better-sqlite3 (compatible con Node 16+)
 * All tables created on first run, no migrations needed for MVP.
 */
'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs               = require('fs');

const DB_PATH = process.env.DB_PATH || './data/linkedin_manager.db';
const dir     = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// Performance settings
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    headline      TEXT DEFAULT '',
    initials      TEXT DEFAULT '',
    cookie        TEXT NOT NULL,
    cookie_expiry TEXT DEFAULT '',
    session_health INTEGER DEFAULT 100,
    status        TEXT DEFAULT 'active',
    daily_limit   INTEGER DEFAULT 150,
    connected_at  TEXT DEFAULT (DATE('now')),
    updated_at    TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT DEFAULT 'draft',
    progress    INTEGER DEFAULT 0,
    sent        INTEGER DEFAULT 0,
    accepted    INTEGER DEFAULT 0,
    replies     INTEGER DEFAULT 0,
    steps       TEXT DEFAULT '[]',
    created_at  TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS leads (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    company    TEXT DEFAULT '',
    initials   TEXT DEFAULT '',
    tags       TEXT DEFAULT '[]',
    score      INTEGER DEFAULT 50,
    stage      TEXT DEFAULT 'new',
    time_label TEXT DEFAULT '',
    created_at TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS threads (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    initials   TEXT DEFAULT '',
    title      TEXT DEFAULT '',
    preview    TEXT DEFAULT '',
    time_label TEXT DEFAULT '',
    unread     INTEGER DEFAULT 0,
    filter     TEXT DEFAULT 'prospects',
    created_at TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    thread_id  TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    dir        TEXT NOT NULL,
    text       TEXT NOT NULL,
    time_label TEXT DEFAULT '',
    created_at TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id           TEXT PRIMARY KEY,
    account_id   TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    account_name TEXT DEFAULT '',
    status       TEXT DEFAULT 'draft',
    type         TEXT DEFAULT 'Post',
    text         TEXT NOT NULL,
    hashtags     TEXT DEFAULT '[]',
    scheduled_at TEXT,
    published_at TEXT,
    est_reach    TEXT DEFAULT '',
    likes        INTEGER DEFAULT 0,
    comments     INTEGER DEFAULT 0,
    views        INTEGER DEFAULT 0,
    reposts      INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS automations (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL,
    status        TEXT DEFAULT 'paused',
    trigger_key   TEXT DEFAULT 'manual',
    trigger_label TEXT DEFAULT '',
    target        TEXT DEFAULT '{}',
    content       TEXT DEFAULT '{}',
    schedule      TEXT DEFAULT '{"dailyLimit":20}',
    actions_today INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0,
    success_rate  INTEGER DEFAULT 0,
    last_run      TEXT DEFAULT 'Nunca',
    created_at    TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_log (
    id         TEXT PRIMARY KEY,
    account_id TEXT,
    auto_id    TEXT REFERENCES automations(id) ON DELETE SET NULL,
    type       TEXT NOT NULL,
    name       TEXT DEFAULT '',
    company    TEXT DEFAULT '',
    initials   TEXT DEFAULT '',
    action     TEXT DEFAULT '',
    result     TEXT DEFAULT 'success',
    created_at TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS activity (
    id         TEXT PRIMARY KEY,
    icon       TEXT DEFAULT '',
    type       TEXT DEFAULT 'connection',
    text       TEXT NOT NULL,
    time_label TEXT DEFAULT '',
    created_at TEXT DEFAULT (DATETIME('now'))
  );

  CREATE TABLE IF NOT EXISTS discovered_profiles (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    headline       TEXT DEFAULT '',
    profile_url    TEXT UNIQUE,
    location       TEXT DEFAULT '',
    match_score    INTEGER DEFAULT 0,
    source         TEXT DEFAULT 'search',
    status         TEXT DEFAULT 'new',
    automation_id  TEXT REFERENCES automations(id) ON DELETE SET NULL,
    discovered_at  TEXT DEFAULT (DATETIME('now')),
    last_action    TEXT DEFAULT '',
    last_action_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_discovered_status ON discovered_profiles(status);
  CREATE INDEX IF NOT EXISTS idx_discovered_score ON discovered_profiles(match_score DESC);
`);

// ── Seed automations (solo en el primer arranque) ─────────────────────────────
const autoCount = db.prepare('SELECT COUNT(*) as cnt FROM automations').get();
if (!autoCount || autoCount.cnt === 0) {
  const seedAutos = [
    {
      id: 'auto-like-001',
      name: 'Like a posts del nicho',
      type: 'like',
      status: 'paused',
      trigger_label: 'Keywords: bienestar, RRHH, talento',
      target: JSON.stringify({ keywords: ['bienestar', 'RRHH', 'talento', 'liderazgo'] }),
      content: '{}',
      schedule: JSON.stringify({ dailyLimit: 15, hours: [9, 12, 17] }),
    },
    {
      id: 'auto-view-001',
      name: 'Ver perfiles — HR Directors LATAM',
      type: 'view',
      status: 'paused',
      trigger_label: 'Título: HR Director, People Manager',
      target: JSON.stringify({ titles: ['HR Director', 'People Manager', 'CHRO'] }),
      content: '{}',
      schedule: JSON.stringify({ dailyLimit: 20, hours: [10, 15] }),
    },
    {
      id: 'auto-msg-001',
      name: 'Follow-up — 3 días sin respuesta',
      type: 'followup',
      status: 'paused',
      trigger_label: '3 días sin respuesta',
      target: '{}',
      content: JSON.stringify({ template: 'Hola {{nombre}}, te escribo brevemente. ¿Tuviste oportunidad de ver mi mensaje?' }),
      schedule: JSON.stringify({ dailyLimit: 10, delayDays: 3 }),
    },
  ];

  for (const a of seedAutos) {
    db.prepare(`
      INSERT OR IGNORE INTO automations (id, name, type, status, trigger_label, target, content, schedule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(a.id, a.name, a.type, a.status, a.trigger_label, a.target, a.content, a.schedule);
  }
  console.log('[DB] Seed automations insertadas');
}

module.exports = db;
