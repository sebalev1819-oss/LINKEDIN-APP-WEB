/**
 * backend/src/routes/automations.js
 * Automation CRUD, toggle, run-now, stats, log.
 */
'use strict';

const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../db');
const queue = require('../services/queue');
const li   = require('../services/linkedin');

// GET /api/automations
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM automations ORDER BY created_at DESC').all();
  res.json(rows.map(formatAuto));
});

// GET /api/automations/stats
router.get('/stats', (req, res) => {
  const active    = db.prepare("SELECT COUNT(*) as cnt FROM automations WHERE status='active'").get()?.cnt || 0;
  const today     = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE DATE(created_at)=DATE('now')").get()?.cnt || 0;
  const msgs      = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE type='send_message' AND DATE(created_at)=DATE('now')").get()?.cnt || 0;
  const successRate = calculateSuccessRate();
  res.json({ active, actionsToday: today, messagesSent: msgs, successRate });
});

// GET /api/automations/log
router.get('/log', (req, res) => {
  const rows = db.prepare('SELECT * FROM automation_log ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows.map(r => ({
    time:    new Date(r.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    type:    r.type,
    name:    r.name,
    company: r.company,
    initials:r.initials || (r.name || '??').slice(0, 2).toUpperCase(),
    action:  r.action,
    result:  r.result,
  })));
});

// POST /api/automations
router.post('/', (req, res) => {
  const { type, targets, schedule, content } = req.body;
  const id   = uuid();
  const name = \`\${labelForType(type)} — nueva regla\`;
  db.prepare(\`
    INSERT INTO automations (id, name, type, status, trigger_key, trigger_label, target, content, schedule, created_at)
    VALUES (?, ?, ?, 'active', 'manual', ?, ?, ?, ?, DATETIME('now'))
  \`).run(id, name, type || 'message', 'Configurado manualmente',
    JSON.stringify(targets || {}), JSON.stringify(content || {}), JSON.stringify(schedule || { dailyLimit: 20 }));
  res.json(formatAuto(db.prepare('SELECT * FROM automations WHERE id = ?').get(id)));
});

// POST /api/automations/:id/toggle
router.post('/:id/toggle', (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'No encontrada' });
  const newStatus = a.status === 'active' ? 'paused' : 'active';
  db.prepare('UPDATE automations SET status = ? WHERE id = ?').run(newStatus, a.id);
  res.json({ ok: true, status: newStatus });
});

// POST /api/automations/:id/run  ← Ejecutar inmediatamente
router.post('/:id/run', async (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'No encontrada' });

  const account = db.prepare("SELECT * FROM accounts WHERE status='active' LIMIT 1").get();
  if (!account) return res.json({ ok: false, error: 'No hay cuentas de LinkedIn conectadas' });

  const target   = JSON.parse(a.target   || '{}');
  const content  = JSON.parse(a.content  || '{}');
  const schedule = JSON.parse(a.schedule || '{}');
  const batchSize = Math.min(schedule.dailyLimit || 5, 5);

  try {
    switch (a.type) {

      case 'like': {
        const result = await li.likePostsFromFeed(account.id, account.cookie, batchSize);
        return res.json({ ok: result.ok, liked: result.liked });
      }

      case 'comment': {
        const urls = target.profileUrls || [];
        const commentText = content.template || 'Excelente contenido!';
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({ type: queue.JobType.COMMENT_POST, accountId: account.id, cookie: account.cookie, automationId: a.id, data: { postUrl: url, comment: commentText, actionLabel: 'Comentario publicado' } });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'message':
      case 'followup': {
        const urls = target.profileUrls || [];
        const message = content.template || 'Hola, me gustaría conectar.';
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({ type: queue.JobType.SEND_MESSAGE, accountId: account.id, cookie: account.cookie, automationId: a.id, data: { profileUrl: url, message, actionLabel: 'Mensaje enviado' } });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'connection': {
        const urls = target.profileUrls || [];
        const note = content.template || '';
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({ type: queue.JobType.CONNECTION_REQUEST, accountId: account.id, cookie: account.cookie, automationId: a.id, data: { profileUrl: url, note, actionLabel: 'Solicitud enviada' } });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'view': {
        const urls = target.profileUrls || [];
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({ type: queue.JobType.VIEW_PROFILE, accountId: account.id, cookie: account.cookie, automationId: a.id, data: { profileUrl: url, actionLabel: 'Perfil visitado' } });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'endorse': {
        const urls = target.profileUrls || [];
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({ type: queue.JobType.ENDORSE_SKILL, accountId: account.id, cookie: account.cookie, automationId: a.id, data: { profileUrl: url, actionLabel: 'Skill endorsado' } });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      default:
        return res.json({ ok: false, error: \`Tipo desconocido: \${a.type}\` });
    }
  } catch (err) {
    console.error('[AutoRun] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/automations/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM automations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function formatAuto(a) {
  let target = {}, content = {}, schedule = {};
  try { target   = JSON.parse(a.target || '{}');   } catch {}
  try { content  = JSON.parse(a.content || '{}');  } catch {}
  try { schedule = JSON.parse(a.schedule || '{}'); } catch {}
  return {
    id: a.id, name: a.name, type: a.type, status: a.status,
    trigger: a.trigger_key, triggerLabel: a.trigger_label,
    target, content, schedule,
    stats: { actionsToday: a.actions_today || 0, total: a.total_actions || 0, successRate: a.success_rate || 0 },
    lastRun: a.last_run ? relativeTime(a.last_run) : 'Nunca',
  };
}

function labelForType(type) {
  const labels = { message:'Mensaje', like:'Me Gusta', comment:'Comentar posts', followup:'Follow-up', view:'Ver perfiles', endorse:'Endorsar skills', connection:'Solicitudes de conexión' };
  return labels[type] || 'Automatización';
}

function calculateSuccessRate() {
  const total   = db.prepare('SELECT COUNT(*) as cnt FROM automation_log').get()?.cnt || 0;
  const success = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE result='success'").get()?.cnt || 0;
  return total > 0 ? Math.round((success / total) * 100) : 100;
}

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return \`Hace \${mins} min\`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return \`Hace \${hrs} h\`;
  return \`Hace \${Math.floor(hrs / 24)} días\`;
}

module.exports = router;
