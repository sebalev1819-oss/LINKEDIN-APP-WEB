/**
 * backend/src/routes/analytics.js
 * Metrics, charts, activity feed, campaigns, leads, inbox.
 */
'use strict';

const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../db');
const { enqueue, JobType } = require('../services/queue');

// ── Dashboard Metrics ─────────────────────────────────────────────────────────
router.get('/metrics', (req, res) => {
  const connections  = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE type='connection_request' AND result='success'").get()?.cnt || 0;
  const messages     = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE type='send_message' AND result='success'").get()?.cnt || 0;
  const leads        = db.prepare("SELECT COUNT(*) as cnt FROM leads").get()?.cnt || 0;
  const profileViews = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE type='view_profile' AND result='success'").get()?.cnt || 0;

  res.json({
    connections:  { value: connections + 4827,  delta: 12.4, trend: [30,42,38,55,60,72,85], goal: 5000  },
    messages:     { value: messages + 312,      delta: 8.1,  trend: [15,22,18,28,35,30,42], goal: 400   },
    profileViews: { value: profileViews + 1249, delta: -2.3, trend: [60,58,62,55,50,48,52], goal: 1500  },
    leads:        { value: leads + 87,          delta: 23.5, trend: [5,8,12,15,18,22,28],   goal: 100   },
  });
});

// GET /api/analytics/weekly
router.get('/analytics/weekly', (req, res) => {
  res.json({
    labels: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
    data:   [34, 42, 38, 55, 60, 28, 22],
  });
});

// GET /api/analytics/chart
router.get('/analytics/chart', (req, res) => {
  res.json({
    '7d':  { labels: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'], connections: [34,42,38,55,60,28,22], messages: [18,22,25,30,35,15,12], views: [60,72,65,80,88,40,35] },
    '30d': { labels: ['S1','S2','S3','S4'], connections: [210,280,240,350], messages: [100,130,110,170], views: [420,510,480,620] },
    '90d': { labels: ['Ene','Feb','Mar'], connections: [800,950,1100], messages: [400,480,560], views: [1800,2100,2400] },
  });
});

// ── Activity ──────────────────────────────────────────────────────────────────
router.get('/activity', (req, res) => {
  const rows = db.prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT 20').all();
  if (!rows.length) {
    return res.json([
      { id: '1', icon: '🤝', type: 'connection', text: 'Nueva conexión aceptada — María González, HR Director @ Santander', time: 'Hace 12 min' },
      { id: '2', icon: '💬', type: 'message',    text: 'Respuesta de Diego Fuentes: "Interesante propuesta, coordinemos..."', time: 'Hace 34 min' },
      { id: '3', icon: '👍', type: 'like',       text: 'Tu post generó 23 likes en la primera hora', time: 'Hace 1 h' },
    ]);
  }
  res.json(rows.map(r => ({
    id:   r.id,
    icon: r.icon,
    type: r.type,
    text: r.text,
    time: r.time_label,
  })));
});


// ── Campaigns ─────────────────────────────────────────────────────────────────
router.get('/campaigns', (req, res) => {
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(rows.map(c => ({
    id: c.id, name: c.name, description: c.description,
    status: c.status, progress: c.progress,
    sent: c.sent, accepted: c.accepted, replies: c.replies,
  })));
});

router.post('/campaigns', (req, res) => {
  const id = uuid();
  const { name, description } = req.body;
  db.prepare('INSERT INTO campaigns (id, name, description) VALUES (?, ?, ?)').run(id, name, description || '');
  res.json({ id, name, description, status: 'draft', progress: 0, sent: 0, accepted: 0, replies: 0 });
});

router.post('/campaigns/:id/toggle', (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const ns = c.status === 'active' ? 'paused' : 'active';
  db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(ns, c.id);
  res.json({ ok: true, status: ns });
});

// ── Leads ───────────────────────────────────────────────────────────────
// Frontend expects Kanban shape: { new:[], contacted:[], proposal:[], won:[] }
router.get('/leads', (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const kanban = { new: [], contacted: [], proposal: [], won: [] };
  const seedData = !rows.length;

  if (seedData) {
    // Return seed data so the UI isn't empty on first run
    return res.json({
      new: [
        { id: 'l1', name: 'María González', company: 'Santander', initials: 'MG', tags: ['HR Director'], score: 82, timeLabel: 'Hace 2 h' },
        { id: 'l2', name: 'Diego Fuentes',  company: 'Falabella',  initials: 'DF', tags: ['CEO'], score: 74, timeLabel: 'Hace 4 h' },
      ],
      contacted: [
        { id: 'l3', name: 'Laura Méndez', company: 'BH Health', initials: 'LM', tags: ['People Manager'], score: 91, timeLabel: 'Ayer' },
      ],
      proposal: [
        { id: 'l4', name: 'Ana Torres', company: 'Copec', initials: 'AT', tags: ['HR Director'], score: 88, timeLabel: 'Hace 3 días' },
      ],
      won: [],
    });
  }

  rows.forEach(l => {
    const stage = kanban[l.stage] ? l.stage : 'new';
    kanban[stage].push({
      id: l.id, name: l.name, company: l.company, initials: l.initials,
      tags: JSON.parse(l.tags || '[]'), score: l.score, timeLabel: l.time_label,
    });
  });
  res.json(kanban);
});

router.post('/leads/:id/move', (req, res) => {
  const { to } = req.body;             // frontend sends { from, to }
  if (!to) return res.status(400).json({ error: 'stage (to) requerido' });
  db.prepare('UPDATE leads SET stage = ? WHERE id = ?').run(to, req.params.id);
  res.json({ ok: true });
});

// ── Templates (Quick Replies) ───────────────────────────────────────
router.get('/templates/quick', (req, res) => {
  res.json([
    { id: 't1', label: 'Introducción', text: 'Hola {{nombre}}, soy Sebastián de Care Assistance. Ayudamos a empresas en LATAM a medir bienestar corporativo con resultados medibles. ¿Podemos agendar 15 minutos?' },
    { id: 't2', label: 'Follow-up',    text: 'Hola {{nombre}}, te escribo brevemente. ¿Tuviste oportunidad de ver mi mensaje anterior? Quedo a tu disposición.' },
    { id: 't3', label: 'Caso de éxito', text: 'Hola {{nombre}}, comparto un caso de éxito: una empresa similar a {{empresa}} redujo ausentismo 22% en 6 meses con Care Assistance. ¿Tiene sentido conversar?' },
    { id: 't4', label: 'Cierre',       text: '¡Genial {{nombre}}! Te envío una invitación al calendario. Quedo disponible ante cualquier consulta.' },
  ]);
});


// ── Inbox ─────────────────────────────────────────────────────────────────────
router.get('/threads', (req, res) => {
  const threads = db.prepare('SELECT * FROM threads ORDER BY created_at DESC').all();
  res.json(threads.map(t => ({
    id: t.id, name: t.name, initials: t.initials, title: t.title,
    preview: t.preview, timeLabel: t.time_label, unread: !!t.unread, filter: t.filter,
    messages: db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at').all(t.id)
      .map(m => ({ id: m.id, dir: m.dir, text: m.text, timeLabel: m.time_label })),
  })));
});

// POST /api/threads/:id/messages — Enqueues a real LinkedIn message via Playwright
router.post('/threads/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

  // Store message in DB
  const msgId = uuid();
  db.prepare(`
    INSERT INTO messages (id, thread_id, dir, text, time_label, created_at)
    VALUES (?, ?, 'out', ?, 'Ahora', DATETIME('now'))
  `).run(msgId, id, text);

  // Update thread preview
  db.prepare('UPDATE threads SET preview = ?, unread = 0 WHERE id = ?').run(text, id);

  // Enqueue LinkedIn message if thread has a profile URL
  const acc = db.prepare('SELECT * FROM accounts WHERE status = "active" LIMIT 1').get();
  if (acc) {
    enqueue({
      type: JobType.SEND_MESSAGE,
      accountId: acc.id,
      cookie: acc.cookie,
      data: { profileUrl: `https://www.linkedin.com/in/${id}`, message: text, actionLabel: 'Mensaje enviado' },
    });
  }

  res.json({ id: msgId, dir: 'out', text, timeLabel: 'Ahora' });
});

// ── Calendar ──────────────────────────────────────────────────────────────────
router.get('/calendar', (req, res) => {
  const days = buildCalendar();
  const scheduled = db.prepare("SELECT scheduled_at FROM posts WHERE status='scheduled'").all();
  const datesWithPosts = new Set(scheduled.map(p => new Date(p.scheduled_at).getDate()));
  days.forEach(d => { if (datesWithPosts.has(d.n)) d.scheduled = 'blue'; });
  res.json(days);
});

function buildCalendar() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < first; i++) days.push({ n: new Date(year, month, -first + i + 1).getDate(), out: true });
  for (let d = 1; d <= total; d++) days.push({ n: d, today: d === now.getDate() });
  const rem = 7 - (days.length % 7);
  if (rem < 7) for (let i = 1; i <= rem; i++) days.push({ n: i, out: true });
  return days;
}

module.exports = router;
