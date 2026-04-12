/**
 * src/js/charts.js
 * Reusable SVG chart primitives — decoupled from dashboard state.
 */

// ── Constants ─────────────────────────────────────────────────────────────────
export const SERIES_CONFIG = [
  { key: 'connections', color: '#4f8cff', label: 'Conexiones' },
  { key: 'messages',    color: '#a855f7', label: 'Mensajes'   },
  { key: 'views',       color: '#22d3ee', label: 'Vistas'     },
];

// ── Sparkline ─────────────────────────────────────────────────────────────────
export function sparkline(values, color = '#4f8cff') {
  const w = 90, h = 38, pad = 2;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const xStep = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  // Unique gradient id to avoid SVG defs collision
  const gId = `sp-${color.slice(1)}-${Math.random().toString(36).slice(2, 6)}`;
  return `
    <svg class="metric-spark" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${color}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>
      <polygon fill="url(#${gId})" points="${pts} ${w - pad},${h - pad} ${pad},${h - pad}"/>
    </svg>
  `;
}

// ── Bezier path helper ────────────────────────────────────────────────────────
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cpx = (p.x + c.x) / 2;
    d += ` C${cpx},${p.y} ${cpx},${c.y} ${c.x},${c.y}`;
  }
  return d;
}

/**
 * Build a line chart.
 * @param {object} data   — { labels, connections, messages, views }
 * @param {Set}    hidden — series keys to hide
 * @returns {{ html: string, bind: (bodyEl: HTMLElement) => void }}
 */
export function buildLineChart(data, hidden = new Set()) {
  const W = 640, H = 220, P = { top: 20, right: 20, bottom: 30, left: 44 };
  const plotW = W - P.left - P.right;
  const plotH = H - P.top - P.bottom;
  const cols  = (data.labels || []).length || 7;
  const step  = cols > 1 ? plotW / (cols - 1) : plotW;

  // Y scale across visible series
  const activeSeries = SERIES_CONFIG.filter(s => !hidden.has(s.key) && data[s.key]);
  const allVals = activeSeries.flatMap(s => data[s.key]);
  const yMax = allVals.length ? Math.max(...allVals) * 1.15 : 100;
  const yMin = 0;

  // Grid + Y labels
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const y = P.top + (plotH / 4) * i;
    const v = Math.round(yMax - ((yMax - yMin) / 4) * i);
    grid += `<line x1="${P.left}" y1="${y}" x2="${W - P.right}" y2="${y}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,5"/>`;
    grid += `<text x="${P.left - 8}" y="${y + 4}" text-anchor="end" fill="#565d73" font-size="10" font-family="Inter">${v}</text>`;
  }

  // X labels
  let xlbls = '';
  (data.labels || []).forEach((lbl, i) => {
    xlbls += `<text x="${P.left + i * step}" y="${H - 8}" text-anchor="middle" fill="#8a91a6" font-size="11" font-family="Inter" font-weight="500">${lbl}</text>`;
  });

  // Gradient defs
  const defs = SERIES_CONFIG.map((s, idx) =>
    `<linearGradient id="lc-area-${idx}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%"   stop-color="${s.color}"/>
      <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
    </linearGradient>`
  ).join('');

  // Paths, area fills, hover dots
  let paths = '';
  SERIES_CONFIG.forEach((s, idx) => {
    if (!data[s.key] || hidden.has(s.key)) return;
    const pts = data[s.key].map((v, i) => ({
      x: P.left + i * step,
      y: P.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH,
      v,
    }));
    const d    = smoothPath(pts);
    const area = `${d} L${pts.at(-1).x},${P.top + plotH} L${pts[0].x},${P.top + plotH} Z`;
    paths += `<path d="${area}" fill="url(#lc-area-${idx})" opacity="0.18"/>`;
    paths += `<path class="series-line" data-series="${s.key}" d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => {
      paths += `<circle class="chart-dot" data-series="${s.key}" data-col="${i}" cx="${p.x}" cy="${p.y}" r="4.5" fill="${s.color}" stroke="#11141e" stroke-width="2" opacity="0"/>`;
    });
  });

  // Vertical cursor line
  const cursor = `<line class="chart-cursor" x1="0" y1="${P.top}" x2="0" y2="${P.top + plotH}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,4" opacity="0"/>`;

  // Invisible hit bars for per-column hover
  let hits = '';
  for (let i = 0; i < cols; i++) {
    const cx   = P.left + i * step;
    const barW = Math.max(step, 24);
    hits += `<rect class="chart-hitbar" data-col="${i}" x="${cx - barW / 2}" y="${P.top}" width="${barW}" height="${plotH}" fill="transparent"/>`;
  }

  const html = `
    <div class="chart-body-inner">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
           style="width:100%;height:100%;overflow:visible;" class="line-chart-svg">
        <defs>${defs}</defs>
        ${grid}${paths}${xlbls}${cursor}${hits}
      </svg>
      <div class="chart-tooltip" role="tooltip"></div>
    </div>
  `;

  // ── Bind interactivity ──────────────────────────────────────────────────────
  const bind = (bodyEl) => {
    bodyEl.innerHTML = html;
    const svg     = bodyEl.querySelector('.line-chart-svg');
    const tooltip = bodyEl.querySelector('.chart-tooltip');
    const cursor  = svg?.querySelector('.chart-cursor');
    if (!svg) return;

    const showDots = (col = null) => {
      svg.querySelectorAll('.chart-dot').forEach(d => {
        const match = col === null || parseInt(d.dataset.col) === col;
        d.style.opacity    = match ? '1' : '0.15';
        d.style.transition = 'opacity 120ms';
      });
    };

    svg.addEventListener('mouseleave', () => {
      svg.querySelectorAll('.chart-dot').forEach(d => { d.style.opacity = '0'; });
      tooltip.classList.remove('visible');
      if (cursor) { cursor.style.opacity = '0'; }
    });

    svg.querySelectorAll('.chart-hitbar').forEach(bar => {
      bar.addEventListener('mouseenter', () => {
        const col = parseInt(bar.dataset.col);
        const lbl = data.labels?.[col] ?? `Col ${col}`;
        showDots(col);

        // Cursor line
        const cx = P.left + col * step;
        if (cursor) { cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.style.opacity = '1'; }

        // Tooltip rows
        const rows = SERIES_CONFIG
          .filter(s => !hidden.has(s.key) && data[s.key]?.[col] !== undefined)
          .map(s => `
            <div class="tt-row">
              <span class="tt-dot" style="background:${s.color}"></span>
              <span class="tt-label">${s.label}</span>
              <span class="tt-val">${data[s.key][col].toLocaleString('es-AR')}</span>
            </div>`)
          .join('');

        tooltip.innerHTML = `<div class="tt-head">${lbl}</div>${rows}`;
        tooltip.classList.add('visible');

        // Floating position
        const bodyRect = bodyEl.getBoundingClientRect();
        const svgRect  = svg.getBoundingClientRect();
        const xPx      = (cx / W) * svgRect.width;
        const absX     = svgRect.left - bodyRect.left + xPx;
        const tipW     = tooltip.offsetWidth || 160;
        const left     = absX + tipW + 24 > bodyRect.width ? absX - tipW - 12 : absX + 14;
        tooltip.style.left = `${Math.max(4, left)}px`;
        tooltip.style.top  = `${svgRect.top - bodyRect.top + 8}px`;
      });

      bar.addEventListener('mouseleave', () => {
        svg.querySelectorAll('.chart-dot').forEach(d => { d.style.opacity = '0'; });
        tooltip.classList.remove('visible');
        if (cursor) cursor.style.opacity = '0';
      });
    });
  };

  return { html, bind };
}
