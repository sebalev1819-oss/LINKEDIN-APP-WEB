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
const matcher = require('../services/matcher');
const ai     = require('../services/ai-comments');

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
  const rows = db.prepare(`
    SELECT * FROM automation_log
    ORDER BY created_at DESC LIMIT 50
  `).all();

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

  const validTypes = ['message', 'like', 'comment', 'followup', 'view', 'endorse', 'connection', 'smart_engage'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido: ${type}. Válidos: ${validTypes.join(', ')}` });
  }

  const id   = uuid();
  const name = `${labelForType(type)} — nueva regla`;

  db.prepare(`
    INSERT INTO automations (id, name, type, status, trigger_key, trigger_label, target, content, schedule, created_at)
    VALUES (?, ?, ?, 'active', 'manual', ?, ?, ?, ?, DATETIME('now'))
  `).run(
    id, name, type || 'message',
    'Configurado manualmente',
    JSON.stringify(targets || {}),
    JSON.stringify(content || {}),
    JSON.stringify(schedule || { dailyLimit: 20 }),
  );

  res.json(formatAuto(db.prepare('SELECT * FROM automations WHERE id = ?').get(id)));
});

// POST /api/automations/:id/toggle
router.post('/:id/toggle', (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Automatización no encontrada' });

  const newStatus = a.status === 'active' ? 'paused' : 'active';
  db.prepare("UPDATE automations SET status = ? WHERE id = ?").run(newStatus, a.id);
  res.json({ ok: true, status: newStatus });
});

// POST /api/automations/:id/run  ← NUEVO: ejecutar inmediatamente
router.post('/:id/run', async (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Automatización no encontrada' });

  // Get first active account
  const account = db.prepare("SELECT * FROM accounts WHERE status='active' LIMIT 1").get();
  if (!account) {
    return res.json({ ok: false, error: 'No hay cuentas de LinkedIn conectadas' });
  }

  let target, content, schedule;
  try {
    target   = JSON.parse(a.target  || '{}');
    content  = JSON.parse(a.content || '{}');
    schedule = JSON.parse(a.schedule || '{}');
  } catch (parseErr) {
    console.error('[AutoRun] JSON parse error:', parseErr.message);
    return res.status(500).json({ ok: false, error: 'Datos de automatización corruptos — verificá target/content/schedule' });
  }
  const batchSize = Math.min(schedule.dailyLimit || 5, 5);

  try {
    switch (a.type) {

      case 'like': {
        queue.enqueue({
          type: queue.JobType.LIKE_POST,
          accountId: account.id,
          cookie: account.cookie,
          automationId: a.id,
          data: { actionLabel: 'Like desde feed (manual)' },
        });
        // Actually use likePostsFromFeed via queue runner
        const result = await li.likePostsFromFeed(account.id, account.cookie, batchSize);
        return res.json({ ok: result.ok, liked: result.liked });
      }

      case 'comment': {
        const urls = target.profileUrls || [];
        const commentText = content.template || 'Excelente contenido!';
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs de posts configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({
            type: queue.JobType.COMMENT_POST,
            accountId: account.id,
            cookie: account.cookie,
            automationId: a.id,
            data: { postUrl: url, comment: commentText, actionLabel: 'Comentario publicado' },
          });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'message':
      case 'followup': {
        const urls = target.profileUrls || [];
        const message = content.template || 'Hola, me gustaría conectar contigo.';
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs de perfiles configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({
            type: queue.JobType.SEND_MESSAGE,
            accountId: account.id,
            cookie: account.cookie,
            automationId: a.id,
            data: { profileUrl: url, message, actionLabel: 'Mensaje enviado' },
          });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'connection': {
        const urls = target.profileUrls || [];
        const note = content.template || '';
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs de perfiles configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({
            type: queue.JobType.CONNECTION_REQUEST,
            accountId: account.id,
            cookie: account.cookie,
            automationId: a.id,
            data: { profileUrl: url, note, actionLabel: 'Solicitud de conexión enviada' },
          });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'view': {
        const urls = target.profileUrls || [];
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs de perfiles configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({
            type: queue.JobType.VIEW_PROFILE,
            accountId: account.id,
            cookie: account.cookie,
            automationId: a.id,
            data: { profileUrl: url, actionLabel: 'Perfil visitado' },
          });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      case 'endorse': {
        const urls = target.profileUrls || [];
        if (!urls.length) return res.json({ ok: false, error: 'No hay URLs de perfiles configuradas' });
        for (const url of urls.slice(0, batchSize)) {
          queue.enqueue({
            type: queue.JobType.ENDORSE_SKILL,
            accountId: account.id,
            cookie: account.cookie,
            automationId: a.id,
            data: { profileUrl: url, actionLabel: 'Skill endorsado' },
          });
        }
        return res.json({ ok: true, queued: Math.min(urls.length, batchSize) });
      }

      default:
        return res.json({ ok: false, error: `Tipo desconocido: ${a.type}` });
    }
  } catch (err) {
    console.error('[AutoRun] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/automations/run-action — direct action from automations.html
router.post('/run-action', async (req, res) => {
  const { accountId, action, text, postUrl, profileUrl, note, limit } = req.body;

  if (!accountId) return res.status(400).json({ ok: false, error: 'accountId requerido' });
  if (!action)    return res.status(400).json({ ok: false, error: 'action requerido' });

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });

  console.log(`[run-action] ${action} para cuenta ${account.name}`);

  try {
    let result;
    switch (action) {
      case 'likeFromFeed':
        result = await li.likePostsFromFeed(account.id, account.cookie, limit || 5);
        break;
      case 'likePost':
        if (!postUrl) return res.status(400).json({ ok: false, error: 'postUrl requerido' });
        result = await li.likePost(account.id, account.cookie, postUrl);
        break;
      case 'publishPost':
        if (!text) return res.status(400).json({ ok: false, error: 'text requerido' });
        result = await li.publishPost(account.id, account.cookie, text);
        break;
      case 'commentPost':
        if (!postUrl) return res.status(400).json({ ok: false, error: 'postUrl requerido' });
        if (!text)    return res.status(400).json({ ok: false, error: 'text requerido' });
        result = await li.commentPost(account.id, account.cookie, postUrl, text);
        break;
      case 'sendConnectionRequest':
        if (!profileUrl) return res.status(400).json({ ok: false, error: 'profileUrl requerido' });
        result = await li.sendConnectionRequest(account.id, account.cookie, profileUrl, note || '');
        break;
      case 'viewProfile':
        if (!profileUrl) return res.status(400).json({ ok: false, error: 'profileUrl requerido' });
        result = await li.viewProfile(account.id, account.cookie, profileUrl);
        break;
      default:
        return res.status(400).json({ ok: false, error: 'Acción desconocida: ' + action });
    }

    // Log the action
    if (result && result.ok) {
      db.prepare(`
        INSERT INTO automation_log (id, account_id, type, action, result, created_at)
        VALUES (?, ?, ?, ?, 'success', DATETIME('now'))
      `).run(uuid(), accountId, action, action);
    }

    return res.json(result || { ok: false, error: 'Sin respuesta' });
  } catch (err) {
    console.error('[run-action] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/automations/:id — update automation rule
router.put('/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Automatización no encontrada' });

  const { name, type, targets, content, schedule } = req.body;
  const validTypes = ['message', 'like', 'comment', 'followup', 'view', 'endorse', 'connection', 'smart_engage'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido: ${type}` });
  }

  db.prepare(`
    UPDATE automations SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      target = COALESCE(?, target),
      content = COALESCE(?, content),
      schedule = COALESCE(?, schedule)
    WHERE id = ?
  `).run(
    name || null,
    type || null,
    targets ? JSON.stringify(targets) : null,
    content ? JSON.stringify(content) : null,
    schedule ? JSON.stringify(schedule) : null,
    req.params.id,
  );

  res.json(formatAuto(db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id)));
});

// ── Smart Engage Endpoints ───────────────────────────────────────────────────

// POST /api/automations/search-preview — Preview search results without acting
router.post('/search-preview', async (req, res) => {
  const { criteria } = req.body;
  if (!criteria) return res.status(400).json({ error: 'criteria requerido' });

  const account = db.prepare("SELECT * FROM accounts WHERE status='active' LIMIT 1").get();
  if (!account) return res.status(400).json({ error: 'No hay cuentas conectadas' });

  try {
    // Search profiles and scrape feed in parallel
    const [searchResult, feedResult] = await Promise.all([
      li.searchProfiles(account.id, account.cookie, criteria, 20),
      li.scrapeRelevantFeedPosts(account.id, account.cookie, criteria.keywords || [], 10),
    ]);

    // Score and rank results
    const rankedProfiles = matcher.filterAndRankProfiles(searchResult.profiles || [], criteria, criteria.minScore || 30);
    const rankedPosts = matcher.filterAndRankPosts(feedResult.posts || [], criteria, criteria.minScore || 20);

    res.json({
      ok: true,
      profiles: rankedProfiles,
      feedPosts: rankedPosts,
      summary: {
        profilesFound: searchResult.profiles?.length || 0,
        profilesMatched: rankedProfiles.length,
        postsFound: feedResult.posts?.length || 0,
        postsMatched: rankedPosts.length,
        aiAvailable: ai.isAIAvailable(),
      },
    });
  } catch (err) {
    console.error('[SmartEngage] search-preview error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/automations/smart-run — Execute smart engage cycle
router.post('/smart-run', async (req, res) => {
  const { automationId, criteria, actions } = req.body;

  // Get criteria from automation or request body
  let targetCriteria = criteria;
  let autoRecord = null;

  if (automationId) {
    autoRecord = db.prepare('SELECT * FROM automations WHERE id = ?').get(automationId);
    if (!autoRecord) return res.status(404).json({ error: 'Automatización no encontrada' });
    try { targetCriteria = JSON.parse(autoRecord.target || '{}'); } catch { targetCriteria = {}; }
  }

  if (!targetCriteria) return res.status(400).json({ error: 'criteria o automationId requerido' });

  const account = db.prepare("SELECT * FROM accounts WHERE status='active' LIMIT 1").get();
  if (!account) return res.status(400).json({ error: 'No hay cuentas conectadas' });

  const enabledActions = actions || ['like', 'comment', 'connect'];
  const MAX_ACTIONS = 20;
  let actionCount = 0;
  const results = { liked: 0, commented: 0, connected: 0, viewed: 0, discovered: 0 };

  try {
    // 1. Search profiles
    const searchResult = await li.searchProfiles(account.id, account.cookie, targetCriteria, 15);
    const rankedProfiles = matcher.filterAndRankProfiles(searchResult.profiles || [], targetCriteria, targetCriteria.minScore || 40);

    // 2. Scrape feed
    const feedResult = await li.scrapeRelevantFeedPosts(account.id, account.cookie, targetCriteria.keywords || [], 10);
    const rankedPosts = matcher.filterAndRankPosts(feedResult.posts || [], targetCriteria, 30);

    // 3. Process profiles — view + connect
    for (const profile of rankedProfiles) {
      if (actionCount >= MAX_ACTIONS) break;

      // Check if already discovered
      const existing = db.prepare('SELECT * FROM discovered_profiles WHERE profile_url = ?').get(profile.profileUrl);

      if (!existing) {
        // Save to discovered_profiles
        db.prepare(`
          INSERT OR IGNORE INTO discovered_profiles (id, name, headline, profile_url, location, match_score, source, status, automation_id, discovered_at)
          VALUES (?, ?, ?, ?, ?, ?, 'search', 'new', ?, DATETIME('now'))
        `).run(uuid(), profile.name, profile.headline, profile.profileUrl, profile.location, profile.matchScore, automationId || null);
        results.discovered++;
      }

      const profileStatus = existing?.status || 'new';

      // View profile if new
      if (profileStatus === 'new' && actionCount < MAX_ACTIONS) {
        queue.enqueue({
          type: queue.JobType.VIEW_PROFILE,
          accountId: account.id,
          cookie: account.cookie,
          automationId: automationId || null,
          data: {
            profileUrl: profile.profileUrl,
            contactName: profile.name,
            contactCompany: profile.headline,
            actionLabel: `Perfil visitado (score ${profile.matchScore})`,
          },
        });
        actionCount++;
        results.viewed++;

        // Update status
        db.prepare("UPDATE discovered_profiles SET status = 'viewed', last_action = 'view', last_action_at = DATETIME('now') WHERE profile_url = ?").run(profile.profileUrl);
      }

      // Send connection request if high score and enabled
      if (enabledActions.includes('connect') && profile.matchScore >= 60 && profileStatus !== 'connected' && actionCount < MAX_ACTIONS) {
        const note = await ai.generateConnectionNote({
          name: profile.name,
          headline: profile.headline,
          context: `Match score ${profile.matchScore} — ${targetCriteria.keywords?.join(', ') || 'búsqueda de perfiles'}`,
        });

        queue.enqueue({
          type: queue.JobType.CONNECTION_REQUEST,
          accountId: account.id,
          cookie: account.cookie,
          automationId: automationId || null,
          data: {
            profileUrl: profile.profileUrl,
            note,
            contactName: profile.name,
            contactCompany: profile.headline,
            actionLabel: `Conexión enviada (score ${profile.matchScore})`,
          },
        });
        actionCount++;
        results.connected++;

        db.prepare("UPDATE discovered_profiles SET status = 'contacted', last_action = 'connect', last_action_at = DATETIME('now') WHERE profile_url = ?").run(profile.profileUrl);
      }
    }

    // 4. Process feed posts — like + comment
    for (const post of rankedPosts) {
      if (actionCount >= MAX_ACTIONS) break;

      // Like post
      if (enabledActions.includes('like') && post.postUrl && actionCount < MAX_ACTIONS) {
        queue.enqueue({
          type: queue.JobType.LIKE_POST,
          accountId: account.id,
          cookie: account.cookie,
          automationId: automationId || null,
          data: {
            postUrl: post.postUrl,
            contactName: post.author?.name || '',
            contactCompany: post.author?.headline || '',
            actionLabel: `Like a post (score ${post.matchScore})`,
          },
        });
        actionCount++;
        results.liked++;
      }

      // Comment on high-score posts
      if (enabledActions.includes('comment') && post.matchScore >= 60 && post.postUrl && actionCount < MAX_ACTIONS) {
        const comment = await ai.generateComment({
          postText: post.postText,
          authorName: post.author?.name || '',
          authorHeadline: post.author?.headline || '',
        });

        queue.enqueue({
          type: queue.JobType.COMMENT_POST,
          accountId: account.id,
          cookie: account.cookie,
          automationId: automationId || null,
          data: {
            postUrl: post.postUrl,
            comment,
            contactName: post.author?.name || '',
            contactCompany: post.author?.headline || '',
            actionLabel: `Comentario AI (score ${post.matchScore})`,
          },
        });
        actionCount++;
        results.commented++;
      }

      // Connect with post author if not already connected
      if (enabledActions.includes('connect') && post.author?.profileUrl && post.matchScore >= 50 && actionCount < MAX_ACTIONS) {
        const existingProfile = db.prepare('SELECT * FROM discovered_profiles WHERE profile_url = ?').get(post.author.profileUrl);
        if (!existingProfile) {
          db.prepare(`
            INSERT OR IGNORE INTO discovered_profiles (id, name, headline, profile_url, match_score, source, status, automation_id, discovered_at)
            VALUES (?, ?, ?, ?, ?, 'feed', 'new', ?, DATETIME('now'))
          `).run(uuid(), post.author.name, post.author.headline, post.author.profileUrl, post.matchScore, automationId || null);
          results.discovered++;
        }
      }
    }

    // Update automation stats
    if (automationId) {
      db.prepare(`UPDATE automations SET last_run = DATETIME('now') WHERE id = ?`).run(automationId);
    }

    console.log(`[SmartEngage] Run complete: ${JSON.stringify(results)}`);
    res.json({ ok: true, results, totalActions: actionCount });
  } catch (err) {
    console.error('[SmartEngage] smart-run error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/discovered — List discovered profiles
router.get('/discovered', (req, res) => {
  const { status, minScore, limit } = req.query;
  let query = 'SELECT * FROM discovered_profiles';
  const params = [];
  const where = [];

  if (status) { where.push('status = ?'); params.push(status); }
  if (minScore) { where.push('match_score >= ?'); params.push(parseInt(minScore)); }
  if (where.length) query += ' WHERE ' + where.join(' AND ');

  query += ' ORDER BY match_score DESC, discovered_at DESC';
  query += ` LIMIT ${parseInt(limit) || 50}`;

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    headline: r.headline,
    profileUrl: r.profile_url,
    location: r.location,
    matchScore: r.match_score,
    source: r.source,
    status: r.status,
    discoveredAt: r.discovered_at,
    lastAction: r.last_action,
    lastActionAt: r.last_action_at,
  })));
});

// DELETE /api/automations/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM automations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatAuto(a) {
  let target = {}, content = {}, schedule = {};
  try { target   = JSON.parse(a.target || '{}');   } catch {}
  try { content  = JSON.parse(a.content || '{}');  } catch {}
  try { schedule = JSON.parse(a.schedule || '{}'); } catch {}

  return {
    id:           a.id,
    name:         a.name,
    type:         a.type,
    status:       a.status,
    trigger:      a.trigger_key,
    triggerLabel: a.trigger_label,
    target,
    content,
    schedule,
    stats: {
      actionsToday: a.actions_today || 0,
      total:        a.total_actions || 0,
      successRate:  a.success_rate  || 0,
    },
    lastRun: a.last_run ? relativeTime(a.last_run) : 'Nunca',
  };
}

function labelForType(type) {
  const labels = {
    message:       'Mensaje',
    like:          'Me Gusta',
    comment:       'Comentar posts',
    followup:      'Follow-up',
    view:          'Ver perfiles',
    endorse:       'Endorsar skills',
    connection:    'Solicitudes de conexión',
    smart_engage:  'Smart Engage',
  };
  return labels[type] || 'Automatización';
}

function calculateSuccessRate() {
  try {
    const total   = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE created_at >= DATETIME('now', '-30 days')").get()?.cnt || 0;
    const success = db.prepare("SELECT COUNT(*) as cnt FROM automation_log WHERE result='success' AND created_at >= DATETIME('now', '-30 days')").get()?.cnt || 0;
    return total > 0 ? Math.round((success / total) * 100) : 100;
  } catch { return 100; }
}

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Hace ${hrs} h`;
  return `Hace ${Math.floor(hrs / 24)} días`;
}

module.exports = router;
