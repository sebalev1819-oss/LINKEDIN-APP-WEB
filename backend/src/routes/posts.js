/**
 * backend/src/routes/posts.js
 * Post queue, scheduling and publishing via Playwright.
 */
'use strict';

const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db    = require('../db');
const { enqueue, JobType } = require('../services/queue');

// GET /api/posts/queue
router.get('/queue', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, a.name as acc_name FROM posts p
    LEFT JOIN accounts a ON a.id = p.account_id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all();

  res.json(rows.map(formatPost));
});

// GET /api/posts/hashtags
router.get('/hashtags', (req, res) => {
  res.json({
    'Thought leadership': ['#liderazgo', '#RRHH', '#HRLatam', '#futuroDelTrabajo', '#bienestar', '#talento'],
    'Caso de éxito':      ['#casoDeExito', '#resultados', '#HRLatam', '#empresa', '#impacto'],
    'Storytelling':       ['#startup', '#founders', '#emprendimiento', '#LATAM', '#propósito'],
    'Insight de datos':   ['#datos', '#estadísticas', '#RRHH', '#bienestar', '#talento'],
    'Engagement':         ['#pregunta', '#comunidad', '#HRLatam', '#bienestar', '#debate'],
  });
});

// POST /api/posts
router.post('/', async (req, res) => {
  const { accountId, type, text, hashtags, scheduledAt, publishNow } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'El texto del post no puede estar vacío' });
  }
  if (text.length > 3000) {
    return res.status(400).json({ error: 'El texto no puede superar 3000 caracteres' });
  }

  const id = uuid();
  const acc = accountId ? db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) : null;
  let status = 'draft';

  if (publishNow && acc) {
    status = 'published';
  } else if (scheduledAt) {
    status = 'scheduled';
  }

  db.prepare(`
    INSERT INTO posts (id, account_id, account_name, status, type, text, hashtags, scheduled_at, published_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))
  `).run(
    id,
    accountId || null,
    acc?.name || '',
    status,
    type || 'Post',
    text,
    JSON.stringify(hashtags || []),
    scheduledAt || null,
    publishNow ? new Date().toISOString() : null,
  );

  // If publishNow, enqueue real publication via Playwright
  if (publishNow && acc) {
    enqueue({
      type: JobType.PUBLISH_POST,
      accountId: acc.id,
      cookie: acc.cookie,
      data: { text, actionLabel: 'Post publicado ahora' },
    });
  }

  const created = db.prepare('SELECT p.*, a.name as acc_name FROM posts p LEFT JOIN accounts a ON a.id = p.account_id WHERE p.id = ?').get(id);
  res.json(formatPost(created));
});

// PUT /api/posts/:id — edit draft post
router.put('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  if (post.status === 'published') return res.status(400).json({ error: 'No se puede editar un post ya publicado' });

  const { text, type, hashtags, scheduledAt } = req.body;
  if (text !== undefined && (!text.trim() || text.length > 3000)) {
    return res.status(400).json({ error: 'El texto debe tener entre 1 y 3000 caracteres' });
  }

  db.prepare(`
    UPDATE posts SET
      text = COALESCE(?, text),
      type = COALESCE(?, type),
      hashtags = COALESCE(?, hashtags),
      scheduled_at = COALESCE(?, scheduled_at),
      status = CASE WHEN ? IS NOT NULL THEN 'scheduled' ELSE status END
    WHERE id = ?
  `).run(
    text || null, type || null,
    hashtags ? JSON.stringify(hashtags) : null,
    scheduledAt || null, scheduledAt || null,
    req.params.id,
  );

  const updated = db.prepare('SELECT p.*, a.name as acc_name FROM posts p LEFT JOIN accounts a ON a.id = p.account_id WHERE p.id = ?').get(req.params.id);
  res.json(formatPost(updated));
});

// DELETE /api/posts/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/posts/scheduled
router.get('/scheduled', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, a.name as acc_name FROM posts p
    LEFT JOIN accounts a ON a.id = p.account_id
    WHERE p.status = 'scheduled'
    ORDER BY p.scheduled_at ASC
  `).all();
  res.json(rows.map(formatPost));
});

// ── Helper ────────────────────────────────────────────────────────────────────
function formatPost(p) {
  let hashtags = [];
  try { hashtags = JSON.parse(p.hashtags || '[]'); } catch {}
  return {
    id:           p.id,
    accountId:    p.account_id,
    accountName:  p.acc_name || p.account_name || '',
    status:       p.status,
    type:         p.type,
    text:         p.text,
    hashtags,
    scheduledAt:  p.scheduled_at,
    publishedAt:  p.published_at,
    estimatedReach: p.est_reach || '–',
    metrics: p.status === 'published' ? {
      likes:    p.likes || 0,
      comments: p.comments || 0,
      views:    p.views || 0,
      reposts:  p.reposts || 0,
    } : null,
  };
}

module.exports = router;
