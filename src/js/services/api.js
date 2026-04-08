// API Service Layer
// ----------------------------------------------------------------
// Este módulo es el único punto de contacto entre la UI y los datos.
// Hoy lee desde /src/data/mock.js (datos simulados).
// Mañana, cuando tengas el backend Python (FastAPI / Flask / Puppeteer RPA),
// solo hay que reemplazar los cuerpos de estas funciones con `fetch(...)`.
//
// Ejemplo de migración:
//   export async function getMetrics() {
//     const r = await fetch(`${API_BASE}/metrics`, { headers: authHeaders() });
//     return r.json();
//   }
// ----------------------------------------------------------------

import * as mock from '../../data/mock.js';

// Configuración base — cambiar cuando el backend esté online
export const API_BASE = 'http://localhost:8000/api';
export const USE_MOCK = true;

// Simula latencia de red para que la UI se sienta real
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

async function mockResponse(data, ms) {
  await delay(ms);
  return structuredClone(data);
}

// ---------- Dashboard ----------
export async function getMetrics() {
  if (USE_MOCK) return mockResponse(mock.metrics);
  const r = await fetch(`${API_BASE}/metrics`);
  return r.json();
}

export async function getWeeklyChart() {
  if (USE_MOCK) return mockResponse(mock.weeklyChart);
  const r = await fetch(`${API_BASE}/analytics/weekly`);
  return r.json();
}

export async function getActivity() {
  if (USE_MOCK) return mockResponse(mock.activity);
  const r = await fetch(`${API_BASE}/activity`);
  return r.json();
}

// ---------- Campaigns ----------
export async function getCampaigns() {
  if (USE_MOCK) return mockResponse(mock.campaigns);
  const r = await fetch(`${API_BASE}/campaigns`);
  return r.json();
}

export async function toggleCampaign(id) {
  if (USE_MOCK) {
    const c = mock.campaigns.find((x) => x.id === id);
    if (c) c.status = c.status === 'active' ? 'paused' : 'active';
    return mockResponse({ ok: true });
  }
  const r = await fetch(`${API_BASE}/campaigns/${id}/toggle`, { method: 'POST' });
  return r.json();
}

// ---------- Inbox ----------
export async function getThreads(filter = 'all') {
  if (USE_MOCK) {
    const data = filter === 'all' ? mock.threads : mock.threads.filter((t) => t.filter === filter);
    return mockResponse(data);
  }
  const r = await fetch(`${API_BASE}/threads?filter=${filter}`);
  return r.json();
}

export async function getQuickTemplates() {
  if (USE_MOCK) return mockResponse(mock.quickTemplates);
  const r = await fetch(`${API_BASE}/templates/quick`);
  return r.json();
}

export async function sendMessage(threadId, text) {
  if (USE_MOCK) {
    const t = mock.threads.find((x) => x.id === threadId);
    if (t) t.messages.push({ dir: 'out', text, time: 'ahora' });
    return mockResponse({ ok: true });
  }
  const r = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return r.json();
}

// ---------- Leads CRM ----------
export async function getLeads() {
  if (USE_MOCK) return mockResponse(mock.leads);
  const r = await fetch(`${API_BASE}/leads`);
  return r.json();
}

export async function moveLead(leadId, fromCol, toCol) {
  if (USE_MOCK) {
    const lead = mock.leads[fromCol]?.find((l) => l.id === leadId);
    if (lead) {
      mock.leads[fromCol] = mock.leads[fromCol].filter((l) => l.id !== leadId);
      mock.leads[toCol].push(lead);
    }
    return mockResponse({ ok: true });
  }
  const r = await fetch(`${API_BASE}/leads/${leadId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromCol, to: toCol }),
  });
  return r.json();
}

// ---------- Content scheduler ----------
export async function getScheduledPosts() {
  if (USE_MOCK) return mockResponse(mock.scheduledPosts);
  const r = await fetch(`${API_BASE}/posts/scheduled`);
  return r.json();
}

export async function getCalendarDays() {
  if (USE_MOCK) return mockResponse(mock.calendarDays);
  const r = await fetch(`${API_BASE}/calendar`);
  return r.json();
}
