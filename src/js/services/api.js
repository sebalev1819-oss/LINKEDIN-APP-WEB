/**
 * src/js/services/api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all data access.
 *
 * MODE DETECTION (auto):
 *   - Si el backend responde en http://localhost:8000/api/health → modo LIVE
 *   - Si no hay backend → modo MOCK (datos simulados)
 *
 * Para forzar un modo:
 *   localStorage.setItem('apiMode', 'mock')   → siempre mock
 *   localStorage.setItem('apiMode', 'live')   → siempre live (puede fallar si no hay backend)
 *   localStorage.removeItem('apiMode')         → auto-detección
 */

import * as mock from '../../data/mock.js';

export const API_BASE = 'http://localhost:8000/api';

/** Whether the API layer is currently using mock data. null = not determined yet. */
export function isUsingMock() { return _useMock; }

// ── Mode detection ────────────────────────────────────────────────────────────
let _useMock = null;  // null = not determined yet

async function isMockMode() {
  // Override via localStorage for development
  const forced = localStorage.getItem('apiMode');
  if (forced === 'mock') return true;
  if (forced === 'live') return false;

  // Auto-detect: try to reach the backend health endpoint
  if (_useMock === null) {
    try {
      const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      _useMock = !r.ok;
    } catch {
      _useMock = true;  // backend not available → use mock
    }
    console.info(`[API] Mode: ${_useMock ? '📦 MOCK (sin backend)' : '🌐 LIVE (backend conectado)'}`);
  }
  return _useMock;
}

// Reset so next call re-detects (useful after "Conectar backend" button)
export function resetModeDetection() { _useMock = null; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const delay = (ms = 180) => new Promise(r => setTimeout(r, ms));

async function mockResponse(data, ms = 180) {
  await delay(ms);
  return structuredClone(data);
}

/**
 * Fetch wrapper: handles network errors, non-OK responses, and JSON parsing.
 * Throws a user-friendly error on failure.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  try {
    const r = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!r.ok) {
      let msg = `Error ${r.status}`;
      try { const body = await r.json(); msg = body.error || msg; } catch {}
      throw new Error(msg);
    }

    return r.json();
  } catch (err) {
    // Network error → fallback to mock
    if (err.name === 'TypeError' || err.name === 'AbortError') {
      console.warn(`[API] Backend no disponible (${path}) → usando datos mock`);
      _useMock = true;
      throw err;
    }
    throw err;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getMetrics() {
  if (await isMockMode()) return mockResponse(mock.metrics);
  return apiFetch('/metrics');
}

export async function getWeeklyChart() {
  if (await isMockMode()) return mockResponse(mock.weeklyChart);
  return apiFetch('/analytics/weekly');
}

export async function getChartData() {
  if (await isMockMode()) return mockResponse(mock.chartData);
  return apiFetch('/analytics/chart');
}

export async function getActivity() {
  if (await isMockMode()) return mockResponse(mock.activity);
  return apiFetch('/activity');
}

// ── Campaigns ─────────────────────────────────────────────────────────────────
export async function getCampaigns() {
  if (await isMockMode()) return mockResponse(mock.campaigns);
  return apiFetch('/campaigns');
}

export async function toggleCampaign(id) {
  if (await isMockMode()) {
    const c = mock.campaigns.find(x => x.id === id);
    if (c) c.status = c.status === 'active' ? 'paused' : 'active';
    return mockResponse({ ok: true });
  }
  return apiFetch(`/campaigns/${id}/toggle`, { method: 'POST' });
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
export async function getThreads(filter = 'all') {
  if (await isMockMode()) {
    const data = filter === 'all' ? mock.threads : mock.threads.filter(t => t.filter === filter);
    return mockResponse(data);
  }
  return apiFetch(`/threads${filter !== 'all' ? `?filter=${filter}` : ''}`);
}

export async function getQuickTemplates() {
  if (await isMockMode()) return mockResponse(mock.quickTemplates);
  return apiFetch('/templates/quick');
}

export async function sendMessage(threadId, text) {
  if (await isMockMode()) {
    const t = mock.threads.find(x => x.id === threadId);
    if (t) t.messages.push({ id: Date.now().toString(), dir: 'out', text, time: 'ahora' });
    return mockResponse({ ok: true });
  }
  return apiFetch(`/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ── Leads CRM ─────────────────────────────────────────────────────────────────
export async function getLeads() {
  if (await isMockMode()) return mockResponse(mock.leads);
  return apiFetch('/leads');
}

export async function moveLead(leadId, fromCol, toCol) {
  if (await isMockMode()) {
    const lead = mock.leads[fromCol]?.find(l => l.id === leadId);
    if (lead) {
      mock.leads[fromCol] = mock.leads[fromCol].filter(l => l.id !== leadId);
      if (!mock.leads[toCol]) mock.leads[toCol] = [];
      mock.leads[toCol].push(lead);
    }
    return mockResponse({ ok: true });
  }
  return apiFetch(`/leads/${leadId}/move`, {
    method: 'POST',
    body: JSON.stringify({ from: fromCol, to: toCol }),
  });
}

// ── Content ───────────────────────────────────────────────────────────────────
export async function getScheduledPosts() {
  if (await isMockMode()) return mockResponse(mock.scheduledPosts);
  return apiFetch('/posts/scheduled');
}

export async function getCalendarDays() {
  if (await isMockMode()) return mockResponse(mock.calendarDays);
  return apiFetch('/calendar');
}

// ── Automations ───────────────────────────────────────────────────────────────
export async function getAutomations() {
  if (await isMockMode()) return mockResponse(mock.automations);
  return apiFetch('/automations');
}

export async function getAutomationStats() {
  if (await isMockMode()) return mockResponse(mock.automationStats);
  return apiFetch('/automations/stats');
}

export async function getAutomationLog() {
  if (await isMockMode()) return mockResponse(mock.automationLog);
  return apiFetch('/automations/log');
}

export async function toggleAutomation(id) {
  if (await isMockMode()) {
    const a = mock.automations.find(x => x.id === id);
    if (a) a.status = a.status === 'active' ? 'paused' : 'active';
    return mockResponse({ ok: true });
  }
  return apiFetch(`/automations/${id}/toggle`, { method: 'POST' });
}

export async function createAutomation(data) {
  if (await isMockMode()) {
    const newAuto = {
      id: `a${mock.automations.length + 1}`,
      name: `${data.type} — nueva regla`,
      type: data.type || 'message',
      status: 'active',
      triggerLabel: 'Configurado manualmente',
      trigger: 'manual',
      target: data.targets || {},
      content: data.content || {},
      schedule: data.schedule || { dailyLimit: 20 },
      stats: { actionsToday: 0, total: 0, successRate: 0 },
      lastRun: 'Nunca',
    };
    mock.automations.push(newAuto);
    mock.automationStats.active++;
    return mockResponse(newAuto);
  }
  return apiFetch('/automations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── LinkedIn Accounts (cookie-based) ──────────────────────────────────────────
export async function getAccounts() {
  if (await isMockMode()) return mockResponse(mock.linkedinAccounts, 300);
  return apiFetch('/accounts');
}

export async function connectAccount(cookieData) {
  if (await isMockMode()) {
    const newAcc = {
      id: `acc${mock.linkedinAccounts.length + 1}`,
      name: cookieData.name || 'Nueva cuenta',
      headline: 'Cuenta conectada',
      initials: (cookieData.name || 'NC').slice(0, 2).toUpperCase(),
      cookieSet: true,
      cookieExpiry: '90 días restantes',
      sessionHealth: 100,
      status: 'active',
      connectedAt: new Date().toISOString().slice(0, 10),
      stats: { actionsToday: 0, actionsWeek: 0, postsPublished: 0, connectionsThisMonth: 0 },
      limits: { daily: 150, used: 0 },
    };
    mock.linkedinAccounts.push(newAcc);
    return mockResponse(newAcc, 1500);
  }
  return apiFetch('/accounts/connect', {
    method: 'POST',
    body: JSON.stringify(cookieData),
  });
}

export async function disconnectAccount(id) {
  if (await isMockMode()) {
    const idx = mock.linkedinAccounts.findIndex(a => a.id === id);
    if (idx >= 0) mock.linkedinAccounts.splice(idx, 1);
    return mockResponse({ ok: true });
  }
  return apiFetch(`/accounts/${id}`, { method: 'DELETE' });
}

// ── Post Queue ────────────────────────────────────────────────────────────────
export async function getPostQueue() {
  if (await isMockMode()) return mockResponse(mock.postQueue, 250);
  return apiFetch('/posts/queue');
}

export async function getSuggestedHashtags() {
  if (await isMockMode()) return mockResponse(mock.suggestedHashtags, 100);
  return apiFetch('/posts/hashtags');
}

export async function schedulePost(data) {
  if (await isMockMode()) {
    const acc = mock.linkedinAccounts.find(a => a.id === data.accountId);
    const post = {
      id: `pq${mock.postQueue.length + 1}`,
      accountId: data.accountId,
      accountName: acc?.name || 'Cuenta',
      status: data.publishNow ? 'published' : (data.scheduledAt ? 'scheduled' : 'draft'),
      scheduledAt: data.scheduledAt || null,
      publishedAt: data.publishNow ? 'Ahora' : null,
      type: data.type || 'Post',
      text: data.text,
      hashtags: data.hashtags || [],
      estimatedReach: '1.2K',
      metrics: data.publishNow ? { likes: 0, comments: 0, views: 0, reposts: 0 } : null,
    };
    mock.postQueue.unshift(post);
    return mockResponse(post, 800);
  }
  return apiFetch('/posts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deletePost(id) {
  if (await isMockMode()) {
    const idx = mock.postQueue.findIndex(p => p.id === id);
    if (idx >= 0) mock.postQueue.splice(idx, 1);
    return mockResponse({ ok: true });
  }
  return apiFetch(`/posts/${id}`, { method: 'DELETE' });
}
