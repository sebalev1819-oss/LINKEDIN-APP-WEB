import * as api from '../services/api.js';

// Sparkline SVG generator
function spark(values, color = '#4f8cff') {
  const w = 90, h = 38, pad = 2;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return `
    <svg class="metric-spark" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g-${color.slice(1)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${points}"/>
      <polygon fill="url(#g-${color.slice(1)})" points="${points} ${w - pad},${h - pad} ${pad},${h - pad}"/>
    </svg>
  `;
}

function metricCard({ label, value, delta, trend, iconClass, icon }) {
  const isUp = delta >= 0;
  const sparkColor = iconClass === 'blue' ? '#4f8cff' : iconClass === 'cyan' ? '#22d3ee' : iconClass === 'green' ? '#34d399' : '#f472b6';
  return `
    <div class="card metric-card">
      <div class="metric-icon ${iconClass}">${icon}</div>
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value.toLocaleString('es-AR')}</div>
      <div class="metric-delta ${isUp ? 'up' : 'down'}">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="${isUp ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/>
        </svg>
        ${isUp ? '+' : ''}${delta}% vs sem. pasada
      </div>
      ${spark(trend, sparkColor)}
    </div>
  `;
}

// Line chart
function lineChart(data) {
  const w = 640, h = 220, pad = { top: 20, right: 20, bottom: 30, left: 36 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const series = [
    { values: data.connections, color: '#4f8cff', label: 'connections' },
    { values: data.messages, color: '#a855f7', label: 'messages' },
    { values: data.views, color: '#22d3ee', label: 'views' },
  ];

  const allVals = series.flatMap((s) => s.values);
  const max = Math.max(...allVals) * 1.15;
  const min = 0;
  const step = plotW / (data.labels.length - 1);

  // Grid lines
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH / 4) * i;
    const v = Math.round(max - ((max - min) / 4) * i);
    grid += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2,4"/>`;
    grid += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="#565d73" font-size="10" font-family="Inter">${v}</text>`;
  }

  // X labels
  let xlabels = '';
  data.labels.forEach((lbl, i) => {
    const x = pad.left + i * step;
    xlabels += `<text x="${x}" y="${h - 8}" text-anchor="middle" fill="#8a91a6" font-size="11" font-family="Inter" font-weight="500">${lbl}</text>`;
  });

  // Paths
  let paths = '';
  series.forEach((s, idx) => {
    const pts = s.values.map((v, i) => {
      const x = pad.left + i * step;
      const y = pad.top + plotH - ((v - min) / (max - min)) * plotH;
      return { x, y };
    });
    const d = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
    const area = `${d} L${pts[pts.length - 1].x},${pad.top + plotH} L${pts[0].x},${pad.top + plotH} Z`;
    paths += `
      <path d="${area}" fill="url(#area-${idx})" opacity="0.25"/>
      <path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
    pts.forEach((p) => {
      paths += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${s.color}" stroke="#11141e" stroke-width="1.5"/>`;
    });
  });

  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;">
      <defs>
        <linearGradient id="area-0" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#4f8cff"/><stop offset="100%" stop-color="#4f8cff" stop-opacity="0"/></linearGradient>
        <linearGradient id="area-1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#a855f7" stop-opacity="0"/></linearGradient>
        <linearGradient id="area-2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>
      </defs>
      ${grid}
      ${paths}
      ${xlabels}
    </svg>
  `;
}

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Dashboard</h1>
          <p class="view-subtitle">Vista general de tu actividad en LinkedIn · Últimos 7 días</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
        </div>
      </div>

      <div class="metrics-grid" id="metricsGrid">
        <div class="empty">Cargando métricas...</div>
      </div>

      <div class="dash-grid">
        <div class="card chart-card">
          <div class="chart-header">
            <div>
              <div class="card-title">Actividad semanal</div>
              <div class="card-subtitle">Conexiones, mensajes y visitas</div>
            </div>
            <div class="chart-legend">
              <span><span class="dot" style="background:#4f8cff"></span>Conexiones</span>
              <span><span class="dot" style="background:#a855f7"></span>Mensajes</span>
              <span><span class="dot" style="background:#22d3ee"></span>Vistas</span>
            </div>
          </div>
          <div class="chart-body" id="weeklyChart"></div>
        </div>

        <div class="card">
          <div class="card-title">Actividad reciente <button class="btn-ghost" style="font-size:11px;">Ver todo</button></div>
          <div class="card-subtitle" style="margin-bottom:14px;">Últimas interacciones en tu red</div>
          <div class="activity-list" id="activityList"></div>
        </div>
      </div>
    </div>
  `;

  const [metrics, chart, activity] = await Promise.all([
    api.getMetrics(),
    api.getWeeklyChart(),
    api.getActivity(),
  ]);

  // Metrics
  const icons = {
    connections: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
    messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    views: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    leads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  };
  container.querySelector('#metricsGrid').innerHTML = [
    metricCard({ label: 'Conexiones', value: metrics.connections.value, delta: metrics.connections.delta, trend: metrics.connections.trend, iconClass: 'blue', icon: icons.connections }),
    metricCard({ label: 'Mensajes enviados', value: metrics.messages.value, delta: metrics.messages.delta, trend: metrics.messages.trend, iconClass: 'cyan', icon: icons.messages }),
    metricCard({ label: 'Vistas de perfil', value: metrics.profileViews.value, delta: metrics.profileViews.delta, trend: metrics.profileViews.trend, iconClass: 'warm', icon: icons.views }),
    metricCard({ label: 'Leads generados', value: metrics.leads.value, delta: metrics.leads.delta, trend: metrics.leads.trend, iconClass: 'green', icon: icons.leads }),
  ].join('');

  // Chart
  container.querySelector('#weeklyChart').innerHTML = lineChart(chart);

  // Activity feed
  container.querySelector('#activityList').innerHTML = activity.map((a) => `
    <div class="activity-item">
      <div class="activity-icon">${a.icon}</div>
      <div class="activity-body">
        <div class="activity-text">${a.text}</div>
        <div class="activity-time">${a.time}</div>
      </div>
    </div>
  `).join('');
}
