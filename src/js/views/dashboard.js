/**
 * src/js/views/dashboard.js
 * LinkedIn Manager — Dashboard (Command Center)
 */
import * as api from '../services/api.js';
import { animateCount, toast, escapeHtml } from '../ui.js';
import { sparkline, buildLineChart, SERIES_CONFIG } from '../charts.js';

// ── Date / greeting helpers ───────────────────────────────────────────────────
function todayLabel() {
  const s = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

// ── Dynamic insights (computed from live data) ────────────────────────────────
function computeInsights(metrics, campaigns, leads) {
  const out = [];

  // Best active campaign by reply rate
  const active = campaigns.filter(c => c.status === 'active' && c.stats.sent > 0);
  if (active.length) {
    const best = active.reduce((a, b) =>
      (b.stats.replies / b.stats.sent) > (a.stats.replies / a.stats.sent) ? b : a
    );
    const rate = Math.round((best.stats.replies / best.stats.sent) * 100);
    out.push({ icon: '🔥', text: `Campaña <strong>${escapeHtml(best.name)}</strong> tiene <strong>${rate}% de reply rate</strong> — tu mejor resultado activo.` });
  }

  // Hot leads without follow-up
  const hot = [...(leads.new || []), ...(leads.contacted || [])].filter(l => l.score >= 85);
  if (hot.length) {
    const n = hot.length;
    out.push({ icon: '⚡', text: `<strong>${n} lead${n > 1 ? 's' : ''}</strong> con score 85+ ${n > 1 ? 'esperan' : 'espera'} follow-up en las próximas 48hs.` });
  }

  // Goal proximity
  if (metrics.leads?.goal) {
    const pct = Math.round((metrics.leads.value / metrics.leads.goal) * 100);
    if (pct >= 80 && pct < 100) {
      out.push({ icon: '🎯', text: `Estás al <strong>${pct}%</strong> de tu meta semanal de leads. ¡Solo ${metrics.leads.goal - metrics.leads.value} más!` });
    }
  }

  // Trend fallback
  if (out.length < 2) {
    if (metrics.leads?.delta >= 20)
      out.push({ icon: '📈', text: `Leads creciendo <strong>+${metrics.leads.delta}%</strong> vs semana pasada. ¡Buen momentum!` });
    else
      out.push({ icon: '📅', text: 'Los jueves son tu mejor día para mensajes: <strong>+32% de respuestas</strong> vs el resto de la semana.' });
  }

  return out.slice(0, 3);
}

// ── Brief banner ──────────────────────────────────────────────────────────────
function renderBrief(insights, userName) {
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  return `
    <div class="brief-banner">
      <div class="brief-header">
        <div class="brief-greeting">
          <div class="brief-avatar">${initials}</div>
          <div>
            <div class="brief-greeting-text">${greeting()}, <strong>${escapeHtml(userName)}</strong></div>
            <div class="brief-date">${todayLabel()}</div>
          </div>
        </div>
        <div class="brief-status">
          <span class="status-dot-online"></span>
          LinkedIn activo
        </div>
      </div>
      <div class="brief-insights">
        ${insights.map(ins => `
          <div class="brief-insight">
            <span class="brief-insight-icon">${ins.icon}</span>
            <p>${ins.text}</p>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Metric cards with goal bar ────────────────────────────────────────────────
const ICONS = {
  connections: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
  messages:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  views:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  leads:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
};
const SPARK_COLOR = { blue: '#4f8cff', cyan: '#22d3ee', warm: '#f472b6', green: '#34d399' };

function metricCard({ label, value, delta, trend, goal, iconClass, iconKey }) {
  const isUp = delta >= 0;
  const color = SPARK_COLOR[iconClass] || '#4f8cff';
  const goalPct = goal ? Math.min(Math.round((value / goal) * 100), 100) : null;
  const goalColor = goalPct >= 90 ? 'var(--neon-green)' : goalPct >= 60 ? 'var(--neon-amber)' : 'var(--neon-blue)';
  return `
    <div class="card metric-card">
      <div class="metric-icon ${iconClass}">${ICONS[iconKey]}</div>
      <div class="metric-label">${label}</div>
      <div class="metric-value" data-target="${value}">0</div>
      <div class="metric-delta ${isUp ? 'up' : 'down'}">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="${isUp ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/>
        </svg>
        ${isUp ? '+' : ''}${delta}% vs sem. pasada
      </div>
      ${goal ? `
        <div class="metric-goal-wrap">
          <div class="metric-goal-bar">
            <div class="metric-goal-fill" style="width:${goalPct}%;background:${goalColor};"></div>
          </div>
          <div class="metric-goal-text">
            <span>${value.toLocaleString('es-AR')} / ${goal.toLocaleString('es-AR')}</span>
            <span style="color:${goalColor};font-weight:700;">${goalPct}%</span>
          </div>
        </div>` : ''}
      ${sparkline(trend, color)}
    </div>`;
}

// ── Active campaigns mini-cards ───────────────────────────────────────────────
function miniCampaignCard(c) {
  const rate = c.stats.sent ? Math.round((c.stats.replies / c.stats.sent) * 100) : 0;
  const rateColor = rate >= 20 ? 'var(--neon-green)' : rate >= 10 ? 'var(--neon-amber)' : 'var(--text-3)';
  return `
    <div class="mini-campaign-card">
      <div class="mini-campaign-name">${escapeHtml(c.name)}</div>
      <div class="mini-campaign-stats">
        <span class="mini-stat"><span class="mini-stat-val">${c.stats.sent}</span> enviadas</span>
        <span class="mini-stat"><span class="mini-stat-val" style="color:${rateColor};">${rate}%</span> reply</span>
      </div>
      <div class="campaign-progress" style="margin-top:10px;">
        <div class="campaign-progress-bar" style="width:${c.progress}%"></div>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-top:4px;text-align:right;">${c.progress}%</div>
    </div>`;
}

// ── Activity feed with type pill + CTA ───────────────────────────────────────
const ACTIVITY_TYPES = {
  connection: { color: 'var(--neon-blue)',   label: 'Conexión', action: 'Ver perfil'  },
  message:    { color: 'var(--neon-purple)', label: 'Mensaje',  action: 'Responder'   },
  view:       { color: 'var(--neon-cyan)',   label: 'Vista',    action: 'Ver perfil'  },
  campaign:   { color: 'var(--neon-green)',  label: 'Campaña',  action: 'Ver campaña' },
  post:       { color: 'var(--neon-amber)',  label: 'Post',     action: 'Ver post'    },
};

function activityItem(a) {
  const cfg = ACTIVITY_TYPES[a.type] || ACTIVITY_TYPES.connection;
  return `
    <div class="activity-item" data-type="${escapeHtml(a.type || '')}">
      <div class="activity-icon">${escapeHtml(a.icon)}</div>
      <div class="activity-body">
        <div class="activity-text">${escapeHtml(a.text)}</div>
        <div class="activity-meta">
          <span class="activity-time">${a.time}</span>
          <span class="activity-type-pill" style="--pill-color:${cfg.color};">${cfg.label}</span>
        </div>
      </div>
      <button class="activity-cta" title="${cfg.action}">${cfg.action} →</button>
    </div>`;
}

// ── Legend item ───────────────────────────────────────────────────────────────
function legendItemHTML(s, hidden) {
  return `<button class="chart-legend-item ${hidden.has(s.key) ? 'inactive' : ''}" data-series="${s.key}">
    <span class="dot" style="background:${s.color}"></span>${s.label}
  </button>`;
}

// ── Main render ───────────────────────────────────────────────────────────────
export async function renderDashboard(container) {
  // Instant skeleton
  container.innerHTML = `
    <div class="view">
      <div class="brief-banner skeleton" style="min-height:112px;margin-bottom:24px;"></div>

      <div class="view-header">
        <div>
          <h1 class="view-title">Dashboard</h1>
          <p class="view-subtitle">Vista general de tu actividad en LinkedIn</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" id="exportBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
        </div>
      </div>

      <div class="metrics-grid" id="metricsGrid">
        ${[1,2,3,4].map(() => '<div class="card metric-card skeleton" style="min-height:170px;"></div>').join('')}
      </div>

      <div class="dash-grid">
        <div class="card chart-card">
          <div class="chart-header">
            <div>
              <div class="card-title">Actividad semanal</div>
              <div class="card-subtitle">Conexiones, mensajes y vistas al perfil</div>
            </div>
            <div class="chart-controls">
              <div class="chart-range-btns" id="rangeSelector">
                <button class="range-btn active" data-range="7d">7D</button>
                <button class="range-btn" data-range="30d">30D</button>
                <button class="range-btn" data-range="90d">90D</button>
              </div>
              <div class="chart-legend" id="chartLegend">
                ${SERIES_CONFIG.map(s => legendItemHTML(s, new Set())).join('')}
              </div>
            </div>
          </div>
          <div class="chart-body" id="weeklyChart">
            <div class="skeleton" style="height:220px;border-radius:8px;"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Actividad reciente
            <button class="btn-ghost" id="activityViewAll" style="font-size:11px;">Ver todo</button>
          </div>
          <div class="card-subtitle" style="margin-bottom:14px;">Últimas interacciones en tu red</div>
          <div class="activity-list" id="activityList">
            ${[1,2,3].map(() => '<div class="skeleton" style="height:56px;border-radius:8px;margin-bottom:10px;"></div>').join('')}
          </div>
        </div>
      </div>

      <div id="activeCampaignsSection"></div>
    </div>`;

  // Fetch all data in parallel
  const [metrics, chartsByRange, activity, campaigns, leads, accounts] = await Promise.all([
    api.getMetrics(),
    api.getChartData(),
    api.getActivity(),
    api.getCampaigns(),
    api.getLeads(),
    api.getAccounts().catch(() => []),
  ]);

  // Resolve user name from connected accounts (fallback to generic)
  const userName = accounts?.[0]?.name?.split(' ')[0] || 'Usuario';

  // ── Brief banner ──
  const briefEl = container.querySelector('.brief-banner');
  if (briefEl) {
    const insights = computeInsights(metrics, campaigns, leads);
    briefEl.outerHTML = renderBrief(insights, userName);
  }

  // ── Metrics grid ──
  const grid = container.querySelector('#metricsGrid');
  grid.innerHTML = [
    metricCard({ label: 'Conexiones',       value: metrics.connections.value,  delta: metrics.connections.delta,  trend: metrics.connections.trend,  goal: metrics.connections.goal,  iconClass: 'blue', iconKey: 'connections' }),
    metricCard({ label: 'Mensajes env.',    value: metrics.messages.value,     delta: metrics.messages.delta,     trend: metrics.messages.trend,     goal: metrics.messages.goal,     iconClass: 'cyan', iconKey: 'messages'    }),
    metricCard({ label: 'Vistas de perfil', value: metrics.profileViews.value, delta: metrics.profileViews.delta, trend: metrics.profileViews.trend, goal: metrics.profileViews.goal, iconClass: 'warm', iconKey: 'views'       }),
    metricCard({ label: 'Leads generados',  value: metrics.leads.value,        delta: metrics.leads.delta,        trend: metrics.leads.trend,        goal: metrics.leads.goal,        iconClass: 'green',iconKey: 'leads'       }),
  ].join('');

  grid.querySelectorAll('[data-target]').forEach(el => {
    animateCount(el, parseInt(el.dataset.target, 10));
  });

  // ── Chart with range selector + legend toggle ──
  let currentRange = '7d';
  const hidden = new Set();

  const renderChart = () => {
    const bodyEl = container.querySelector('#weeklyChart');
    if (!bodyEl) return;
    const { bind } = buildLineChart(chartsByRange[currentRange] || chartsByRange['7d'], hidden);
    bind(bodyEl);

    // Sync range buttons
    container.querySelectorAll('.range-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.range === currentRange));

    // Sync legend buttons
    container.querySelectorAll('.chart-legend-item').forEach(btn =>
      btn.classList.toggle('inactive', hidden.has(btn.dataset.series)));
  };

  container.querySelector('#rangeSelector')?.addEventListener('click', e => {
    const btn = e.target.closest('.range-btn');
    if (!btn) return;
    currentRange = btn.dataset.range;
    renderChart();
  });

  container.querySelector('#chartLegend')?.addEventListener('click', e => {
    const btn = e.target.closest('.chart-legend-item');
    if (!btn) return;
    const key = btn.dataset.series;
    hidden.has(key) ? hidden.delete(key) : hidden.add(key);
    renderChart();
  });

  renderChart();

  // ── Activity feed ──
  container.querySelector('#activityList').innerHTML = activity.map(activityItem).join('');
  container.querySelector('#activityList')?.addEventListener('click', e => {
    const btn = e.target.closest('.activity-cta');
    if (!btn) return;
    const item = btn.closest('.activity-item');
    const type = item?.dataset.type;
    // Navigate to the relevant view
    const viewMap = { connection: 'leads', message: 'inbox', view: 'leads', campaign: 'campaigns', post: 'content' };
    const target = viewMap[type] || 'leads';
    document.querySelector(`[data-view="${target}"]`)?.click();
  });
  container.querySelector('#activityViewAll')?.addEventListener('click', () =>
    document.querySelector('[data-view="inbox"]')?.click());

  // ── Active campaigns section ──
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const campaignSection = container.querySelector('#activeCampaignsSection');
  if (campaignSection && activeCampaigns.length) {
    campaignSection.innerHTML = `
      <div class="dash-section">
        <div class="dash-section-hd">
          <div class="card-title">
            Campañas activas
            <span class="nav-badge neon" style="margin-left:8px;">${activeCampaigns.length}</span>
          </div>
          <button class="btn-ghost" id="viewAllCampaigns" style="font-size:11px;">Ver todas →</button>
        </div>
        <div class="mini-campaigns-row">
          ${activeCampaigns.map(miniCampaignCard).join('')}
        </div>
      </div>`;

    campaignSection.querySelector('#viewAllCampaigns')?.addEventListener('click', () => {
      document.querySelector('[data-view="campaigns"]')?.click();
    });
  }

  // ── Export btn — CSV download ──
  container.querySelector('#exportBtn')?.addEventListener('click', () => {
    try {
      // Build CSV from leads + campaigns
      const allLeads = [...(leads.new || []), ...(leads.contacted || []), ...(leads.proposal || []), ...(leads.won || [])];
      if (!allLeads.length) { toast('No hay datos para exportar', 'warning'); return; }

      const header = 'Nombre,Empresa,Score,Etapa,Tags';
      const rows = allLeads.map(l => {
        const stage = (leads.new || []).includes(l) ? 'Nuevo' :
                      (leads.contacted || []).includes(l) ? 'Contactado' :
                      (leads.proposal || []).includes(l) ? 'Propuesta' : 'Cerrado';
        return `"${(l.name || '').replace(/"/g, '""')}","${(l.company || '').replace(/"/g, '""')}",${l.score},"${stage}","${(l.tags || []).join(', ')}"`;
      });

      const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM for Excel UTF-8
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkedin-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Leads exportados a CSV', 'success');
    } catch (err) {
      toast('Error al exportar: ' + err.message, 'error');
    }
  });
}
