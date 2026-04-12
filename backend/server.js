/**
 * backend/server.js
 * LinkedIn Manager — Express API Server
 *
 * Arrancar:  npm run dev     (con hot-reload)
 *            npm start       (producción)
 */
'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const cron        = require('node-cron');
const path        = require('path');

const db = require('./src/db');          // Inicializa SQLite y crea tablas

// En cloud (Render/Railway) Playwright no está disponible — usar stub
let li;
try {
  li = require('./src/services/linkedin');
  console.log('[Server] Playwright disponible — modo automatización completa');
} catch {
  li = require('./src/services/linkedin.cloud');
  console.log('[Server] Playwright no disponible — modo API only (automatización requiere entorno local)');
}

const { checkScheduledPosts, runAutomations } = require('./src/services/queue');

// ── Routes ────────────────────────────────────────────────────────────────────
const accountsRouter    = require('./src/routes/accounts');
const postsRouter       = require('./src/routes/posts');
const automationsRouter = require('./src/routes/automations');
const analyticsRouter   = require('./src/routes/analytics');   // metrics, leads, campaigns, inbox, etc.

// ── App setup ─────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 8000;

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

// CORS — permitir peticiones del frontend (local + Netlify)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:8000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);                          // file://, curl, Postman
    if (origin.endsWith('.netlify.app')) return callback(null, true);  // cualquier deploy Netlify
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate limiting — proteger contra abusos
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,   // 1 minuto
  max: 120,
  message: { error: 'Demasiadas peticiones. Esperá un momento.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Servir el frontend estático
// En desarrollo: sin caché para JS/CSS (los cambios se ven de inmediato con F5)
// En producción: caché normal
const isDev = process.env.NODE_ENV !== 'production';
const frontendDist = path.join(__dirname, '../');

app.use(express.static(frontendDist, {
  index: 'linkedin-manager-standalone.html',
  setHeaders: (res, filePath) => {
    if (isDev && (filePath.endsWith('.js') || filePath.endsWith('.css'))) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));


// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/accounts',     accountsRouter);
app.use('/api/posts',        postsRouter);
app.use('/api/automations',  automationsRouter);
app.use('/api',              analyticsRouter);  // /api/metrics, /api/analytics/*, /api/campaigns, etc.

// Health check
const playwrightAvailable = !!li.validateSession.toString().includes('chromium') === false ? false : true;
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: 'sqlite',
    playwright: li === require('./src/services/linkedin.cloud') ? 'cloud-stub (automation requires local)' : 'ready',
    env: process.env.NODE_ENV || 'development',
  });
});

// 404 fallback — SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'linkedin-manager-standalone.html'));
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

// ── Cron jobs ─────────────────────────────────────────────────────────────────
// Check scheduled posts every minute
cron.schedule('* * * * *', async () => {
  try { await checkScheduledPosts(); }
  catch (err) { console.error('[Cron] checkScheduledPosts error:', err.message); }
});

// Run automations every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try { await runAutomations(); }
  catch (err) { console.error('[Cron] runAutomations error:', err.message); }
});

// Reset daily action counters at midnight
cron.schedule('0 0 * * *', () => {
  db.prepare('UPDATE automations SET actions_today = 0').run();
  console.log('[Cron] Daily counters reset');
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — closing...`);
  await li.closeAllSessions();
  db.close();
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 LinkedIn Manager Backend`);
  console.log(`   URL:       http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api`);
  console.log(`   Health:    http://localhost:${PORT}/api/health`);
  console.log(`   DB:        ${process.env.DB_PATH || './data/linkedin_manager.db'}`);
  console.log(`   Headless:  ${process.env.HEADLESS !== 'false' ? 'ON' : 'OFF (browser visible)'}`);
  console.log(`   Modo:      ${process.env.NODE_ENV || 'development'}\n`);
});
