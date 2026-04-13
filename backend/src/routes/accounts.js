/**
 * backend/src/routes/accounts.js
 * Endpoints for LinkedIn account management (cookie-based sessions).
 */
'use strict';

const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../db');
const li = require('../services/linkedin');

// GET /api/accounts
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM accounts ORDER BY connected_at DESC').all();
  const accounts = rows.map(a => ({
    id: a.id,
    name: a.name,
    headline: a.headline,
    initials: a.initials,
    cookieSet: !!a.cookie,
    cookieExpiry: a.cookie_expiry,
    sessionHealth: a.session_health,
    status: a.status,
    connectedAt: a.connected_at,
    stats: {
      actionsToday: getActionsToday(a.id),
      actionsWeek: getActionsWeek(a.id),
      postsPublished: getPostsPublished(a.id),
      connectionsThisMonth: 0,
    },
    limits: { daily: a.daily_limit, used: getActionsToday(a.id) },
  }));
  res.json(accounts);
});

// POST /api/accounts/connect
router.post('/connect', async (req, res) => {
  const { cookie, name } = req.body;
  if (!cookie || cookie.length < 50) {
    return res.status(400).json({ error: 'Cookie li_at inválida o demasiado corta' });
  }
  if (!/^AQE/.test(cookie)) {
    return res.status(400).json({ error: 'La cookie li_at debe empezar con "AQE". Verificá que copiaste el valor correcto.' });
  }
  // Check for duplicate cookie
  const existing = db.prepare('SELECT id, name FROM accounts WHERE cookie = ?').get(cookie);
  if (existing) {
    return res.status(409).json({ error: `Esta cookie ya está asociada a la cuenta "${existing.name}"` });
  }

  try {
    // Validate session with real LinkedIn
    const validation = await li.validateSession(cookie);
    if (!validation.ok) {
      return res.status(401).json({ error: validation.error || 'Sesión de LinkedIn inválida' });
    }

    const id       = uuid();
    const accName  = name || validation.name || 'Mi cuenta';
    const headline = validation.headline || 'LinkedIn Member';
    const initials = accName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    db.prepare(`
      INSERT INTO accounts (id, name, headline, initials, cookie, session_health, status, daily_limit, connected_at)
      VALUES (?, ?, ?, ?, ?, 100, 'active', 150, DATE('now'))
    `).run(id, accName, headline, initials, cookie);

    return res.json({
      id, name: accName, headline, initials,
      cookieSet: true, sessionHealth: 100, status: 'active',
      stats: { actionsToday: 0, actionsWeek: 0, postsPublished: 0, connectionsThisMonth: 0 },
      limits: { daily: 150, used: 0 },
    });
  } catch (err) {
    console.error('[Route /accounts/connect]', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  await li.closeSession(id);
  res.json({ ok: true });
});

// GET /api/accounts/:id/stats
router.get('/:id/stats', (req, res) => {
  const { id } = req.params;
  res.json({
    actionsToday: getActionsToday(id),
    actionsWeek:  getActionsWeek(id),
    postsPublished: getPostsPublished(id),
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function getActionsToday(accountId) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM automation_log
    WHERE account_id = ? AND DATE(created_at) = DATE('now')
  `).get(accountId);
  return row?.cnt || 0;
}

function getActionsWeek(accountId) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM automation_log
    WHERE account_id = ? AND created_at >= DATETIME('now', '-7 days')
  `).get(accountId);
  return row?.cnt || 0;
}

function getPostsPublished(accountId) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM posts
    WHERE account_id = ? AND status = 'published'
  `).get(accountId);
  return row?.cnt || 0;
}

module.exports = router;
