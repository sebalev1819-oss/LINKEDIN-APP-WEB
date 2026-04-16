/**
 * backend/src/services/queue.js
 * In-memory job queue for LinkedIn automation tasks.
 * Jobs are persisted in SQLite so they survive restarts.
 */
'use strict';

const db      = require('../db');
const li      = require('./linkedin');
const matcher = require('./matcher');
const ai      = require('./ai-comments');
const { v4: uuid } = require('uuid');

const DELAY_MIN = parseInt(process.env.ACTION_DELAY_MIN || '2000', 10);
const DELAY_MAX = parseInt(process.env.ACTION_DELAY_MAX || '8000', 10);

function humanDelay(min = DELAY_MIN, max = DELAY_MAX) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min) + min)));
}

// In-memory queue (simple FIFO)
const jobQueue = [];
let isProcessing = false;

// ── Job types ─────────────────────────────────────────────────────────────────
const JobType = {
  SEND_MESSAGE:         'send_message',
  LIKE_POST:            'like_post',
  COMMENT_POST:         'comment_post',
  VIEW_PROFILE:         'view_profile',
  PUBLISH_POST:         'publish_post',
  CONNECTION_REQUEST:   'connection_request',
  ENDORSE_SKILL:        'endorse_skill',
};

// ── Enqueue ───────────────────────────────────────────────────────────────────
function enqueue(job) {
  const item = { id: uuid(), ...job, addedAt: Date.now() };
  jobQueue.push(item);
  console.log(`[Queue] Added job: ${item.type} for account ${item.accountId}`);
  if (!isProcessing) processNext();
  return item;
}

// ── Process loop ──────────────────────────────────────────────────────────────
async function processNext() {
  if (jobQueue.length === 0) { isProcessing = false; return; }
  isProcessing = true;

  const job = jobQueue.shift();
  console.log(`[Queue] Processing: ${job.type} (${job.id})`);

  try {
    await executeJob(job);
    logAction(job, 'success');
  } catch (err) {
    console.error(`[Queue] Job ${job.id} failed:`, err.message);
    logAction(job, 'fail');
  }

  // Human-like delay between jobs
  await humanDelay();
  processNext();
}

// ── Execute ───────────────────────────────────────────────────────────────────
async function executeJob(job) {
  const { type, accountId, cookie, data } = job;

  switch (type) {
    case JobType.SEND_MESSAGE:
      return li.sendMessage(accountId, cookie, data.profileUrl, data.message);

    case JobType.LIKE_POST:
      return li.likePost(accountId, cookie, data.postUrl);

    case JobType.COMMENT_POST:
      return li.commentPost(accountId, cookie, data.postUrl, data.comment);

    case JobType.VIEW_PROFILE:
      return li.viewProfile(accountId, cookie, data.profileUrl);

    case JobType.PUBLISH_POST:
      return li.publishPost(accountId, cookie, data.text);

    case JobType.CONNECTION_REQUEST:
      return li.sendConnectionRequest(accountId, cookie, data.profileUrl, data.note);

    case JobType.ENDORSE_SKILL:
      return li.endorseSkill(accountId, cookie, data.profileUrl);

    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

// ── Log to DB ─────────────────────────────────────────────────────────────────
function logAction(job, result) {
  try {
    db.prepare(`
      INSERT INTO automation_log (id, account_id, auto_id, type, name, company, initials, action, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))
    `).run(
      uuid(),
      job.accountId,
      job.automationId || null,
      job.type,
      job.data?.contactName || '',
      job.data?.contactCompany || '',
      (job.data?.contactName || '??').slice(0, 2).toUpperCase(),
      job.data?.actionLabel || job.type,
      result,
    );

    // Update automation stats
    if (job.automationId) {
      db.prepare(`
        UPDATE automations
        SET actions_today = actions_today + 1,
            total_actions = total_actions + 1,
            last_run = DATETIME('now')
        WHERE id = ?
      `).run(job.automationId);
    }
  } catch (err) {
    console.error('[Queue] logAction error:', err.message);
  }
}

// ── Scheduled post publisher ──────────────────────────────────────────────────
/** Check for posts that are due to be published. Called every minute by cron. */
async function checkScheduledPosts() {
  const now = new Date().toISOString();
  const duePosts = db.prepare(`
    SELECT p.*, a.cookie FROM posts p
    JOIN accounts a ON a.id = p.account_id
    WHERE p.status = 'scheduled' AND p.scheduled_at <= ?
  `).all(now);

  for (const post of duePosts) {
    console.log(`[Scheduler] Publishing post ${post.id}`);
    enqueue({
      type: JobType.PUBLISH_POST,
      accountId: post.account_id,
      cookie: post.cookie,
      automationId: null,
      data: { text: post.text, actionLabel: 'Post programado publicado' },
    });

    // Mark as published
    db.prepare(`UPDATE posts SET status = 'published', published_at = DATETIME('now') WHERE id = ?`).run(post.id);
  }
}

// ── Automation runner ─────────────────────────────────────────────────────────
/** Run active automations that have capacity. Called every 5 min by cron. */
async function runAutomations() {
  // Grab the first active account. If there are multiple, we pick one per cycle
  // to avoid multiplying every automation by N accounts (which caused each rule
  // to run twice when the user had 2 cuentas activas).
  const account = db.prepare("SELECT id as acc_id, cookie as acc_cookie FROM accounts WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1").get();
  if (!account) {
    console.log('[Automations] No connected accounts (ninguna cuenta activa)');
    return;
  }

  const rules = db.prepare("SELECT * FROM automations WHERE status = 'active' LIMIT 10").all();
  if (!rules.length) {
    console.log('[Automations] No active automations');
    return;
  }

  const automations = rules.map(r => ({ ...r, acc_id: account.acc_id, acc_cookie: account.acc_cookie }));

  for (const auto of automations) {
    let schedule, target, content;
    try {
      schedule = JSON.parse(auto.schedule || '{}');
      target   = JSON.parse(auto.target   || '{}');
      content  = JSON.parse(auto.content  || '{}');
    } catch (parseErr) {
      console.error(`[Automations] JSON parse error in ${auto.name}:`, parseErr.message);
      continue;
    }
    const dailyLimit = schedule.dailyLimit || 10;

    if (auto.actions_today >= dailyLimit) {
      console.log(`[Automations] ${auto.name}: límite diario alcanzado (${auto.actions_today}/${dailyLimit})`);
      continue;
    }

    const remaining = dailyLimit - auto.actions_today;

    console.log(`[Automations] Ejecutando: ${auto.name} (tipo: ${auto.type}, restantes hoy: ${remaining})`);

    try {
      switch (auto.type) {

        case 'like': {
          // Like posts from the feed (up to `remaining` today)
          const batchSize = Math.min(remaining, 3); // max 3 per cron run
          const result = await li.likePostsFromFeed(auto.acc_id, auto.acc_cookie, batchSize);
          if (result.ok && result.liked > 0) {
            for (let i = 0; i < result.liked; i++) {
              logAutoAction(auto, 'like_post', 'Post del feed', 'success');
            }
            console.log(`[Automations] ${auto.name}: ${result.liked} likes dados`);
          }
          break;
        }

        case 'view': {
          // View profiles — uses a sample URL if no specific list
          const url = target.profileUrls?.[0] || 'https://www.linkedin.com/in/williamhgates';
          const result = await li.viewProfile(auto.acc_id, auto.acc_cookie, url);
          if (result.ok) {
            logAutoAction(auto, 'view_profile', result.name || 'Perfil visitado', 'success');
          }
          break;
        }

        case 'message':
        case 'followup': {
          const profileUrl = target.profileUrls?.[0];
          const message    = content.template || 'Hola, me gustaría conectar contigo.';
          if (profileUrl) {
            const result = await li.sendMessage(auto.acc_id, auto.acc_cookie, profileUrl, message);
            if (result.ok) {
              logAutoAction(auto, 'send_message', 'Mensaje enviado', 'success');
            }
          } else {
            console.log(`[Automations] ${auto.name}: sin profileUrls configuradas, saltando`);
          }
          break;
        }

        case 'smart_engage': {
          // Smart Engage: search + feed scrape + match + auto-act
          console.log(`[Automations] Smart Engage: searching profiles and scanning feed`);
          const batchLimit = Math.min(remaining, 10);
          let smartActions = 0;

          // Search profiles
          const searchResult = await li.searchProfiles(auto.acc_id, auto.acc_cookie, target, 10);
          const rankedProfiles = matcher.filterAndRankProfiles(searchResult.profiles || [], target, target.minScore || 40);

          // Scrape feed
          const feedResult = await li.scrapeRelevantFeedPosts(auto.acc_id, auto.acc_cookie, target.keywords || [], 8);
          const rankedPosts = matcher.filterAndRankPosts(feedResult.posts || [], target, 30);

          // Process top profiles: view + connect
          for (const profile of rankedProfiles.slice(0, 5)) {
            if (smartActions >= batchLimit) break;

            const existing = db.prepare('SELECT * FROM discovered_profiles WHERE profile_url = ?').get(profile.profileUrl);
            if (!existing) {
              db.prepare(`INSERT OR IGNORE INTO discovered_profiles (id, name, headline, profile_url, location, match_score, source, status, automation_id, discovered_at)
                VALUES (?, ?, ?, ?, ?, ?, 'search', 'new', ?, DATETIME('now'))`)
                .run(uuid(), profile.name, profile.headline, profile.profileUrl, profile.location || '', profile.matchScore, auto.id);
            }

            if (!existing || existing.status === 'new') {
              enqueue({
                type: JobType.VIEW_PROFILE,
                accountId: auto.acc_id,
                cookie: auto.acc_cookie,
                automationId: auto.id,
                data: { profileUrl: profile.profileUrl, contactName: profile.name, actionLabel: `Smart: perfil visitado (${profile.matchScore}pts)` },
              });
              smartActions++;
              db.prepare("UPDATE discovered_profiles SET status='viewed', last_action='view', last_action_at=DATETIME('now') WHERE profile_url=?").run(profile.profileUrl);
            }

            if (profile.matchScore >= 60 && smartActions < batchLimit) {
              const note = await ai.generateConnectionNote({ name: profile.name, headline: profile.headline });
              enqueue({
                type: JobType.CONNECTION_REQUEST,
                accountId: auto.acc_id,
                cookie: auto.acc_cookie,
                automationId: auto.id,
                data: { profileUrl: profile.profileUrl, note, contactName: profile.name, actionLabel: `Smart: conexión (${profile.matchScore}pts)` },
              });
              smartActions++;
              db.prepare("UPDATE discovered_profiles SET status='contacted', last_action='connect', last_action_at=DATETIME('now') WHERE profile_url=?").run(profile.profileUrl);
            }
          }

          // Process top posts: like + comment
          for (const post of rankedPosts.slice(0, 5)) {
            if (smartActions >= batchLimit) break;

            if (post.postUrl) {
              enqueue({
                type: JobType.LIKE_POST,
                accountId: auto.acc_id,
                cookie: auto.acc_cookie,
                automationId: auto.id,
                data: { postUrl: post.postUrl, contactName: post.author?.name, actionLabel: `Smart: like (${post.matchScore}pts)` },
              });
              smartActions++;
            }

            if (post.matchScore >= 60 && post.postUrl && smartActions < batchLimit) {
              const comment = await ai.generateComment({ postText: post.postText, authorName: post.author?.name, authorHeadline: post.author?.headline });
              enqueue({
                type: JobType.COMMENT_POST,
                accountId: auto.acc_id,
                cookie: auto.acc_cookie,
                automationId: auto.id,
                data: { postUrl: post.postUrl, comment, contactName: post.author?.name, actionLabel: `Smart: comentario AI (${post.matchScore}pts)` },
              });
              smartActions++;
            }
          }

          logAutoAction(auto, 'smart_engage', `Descubiertos: ${rankedProfiles.length} perfiles, ${rankedPosts.length} posts`, 'success');
          console.log(`[Automations] Smart Engage: ${smartActions} actions queued`);
          break;
        }

        default:
          console.log(`[Automations] Tipo desconocido: ${auto.type}`);
      }
    } catch (err) {
      console.error(`[Automations] Error en ${auto.name}:`, err.message);
      logAutoAction(auto, auto.type, 'Error en ejecución', 'fail');
    }

    // Update last_run timestamp
    db.prepare(`UPDATE automations SET last_run = DATETIME('now') WHERE id = ?`).run(auto.id);
  }
}

function logAutoAction(auto, type, actionLabel, result) {
  try {
    db.prepare(`
      INSERT INTO automation_log (id, account_id, auto_id, type, name, action, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, DATETIME('now'))
    `).run(
      require('uuid').v4(),
      auto.acc_id,
      auto.id,
      type,
      auto.name,
      actionLabel,
      result,
    );
    db.prepare(`
      UPDATE automations
      SET actions_today = actions_today + 1,
          total_actions = total_actions + 1,
          last_run = DATETIME('now')
      WHERE id = ?
    `).run(auto.id);
  } catch (err) {
    console.error('[Automations] logAutoAction error:', err.message);
  }
}


module.exports = {
  enqueue,
  JobType,
  checkScheduledPosts,
  runAutomations,
};
