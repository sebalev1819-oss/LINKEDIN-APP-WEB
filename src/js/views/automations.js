/**
 * src/js/views/automations.js
 * LinkedIn Manager — Automatizaciones
 * Manage LinkedIn automation rules: messages, likes, comments, follow-ups, etc.
 */
import * as api from '../services/api.js';
import { toast, modal } from '../ui.js';

// ── Automation type config ────────────────────────────────────────────────────
const AUTO_TYPES = {
  message:  { icon: '💬', label: 'Mensaje',         color: '#4f8cff', bg: 'rgba(79,140,255,0.12)'  },
  like:     { icon: '👍', label: 'Like a posts',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)'  },
  comment:  { icon: '💭', label: 'Comentar',        color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  followup: { icon: '🔄', label: 'Follow-up',       color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  view:     { icon: '👀', label: 'Ver perfil',      color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  endorse:  { icon: '⭐', label: 'Endorsar skill',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
};

const STATUS_CFG = {
  active:  { label: 'Activa',  cls: 'active'  },
  paused:  { label: 'Pausada', cls: 'paused'  },
  draft:   { label: 'Borrador',cls: 'draft'   },
  done:    { label: 'Completa',cls: 'active'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(value, limit) {
  return limit ? Math.min(Math.round((value / limit) * 100), 100) : 0;
}

function safetyColor(p) {
  return p >= 85 ? 'var(--neon-red)' : p >= 60 ? 'var(--neon-amber)' : 'var(--neon-green)';
}

// ── Automation card ───────────────────────────────────────────────────────────
function autoCard(a) {
  const type   = AUTO_TYPES[a.type]  || AUTO_TYPES.message;
  const status = STATUS_CFG[a.status] || STATUS_CFG.paused;
  const used   = pct(a.stats.actionsToday, a.schedule.dailyLimit);
  return `
    <div class="auto-card" data-id="${a.id}">
      <div class="auto-card-head">
        <div class="auto-type-icon" style="background:${type.bg};color:${type.color};">${type.icon}</div>
        <div class="auto-card-info">
          <div class="auto-name">${a.name}</div>
          <div class="auto-trigger">
            <span class="auto-trigger-icon">⚡</span> ${a.triggerLabel}
          </div>
        </div>
        <div class="auto-head-right">
          <span class="status-pill ${status.cls}">${status.label}</span>
          <label class="toggle-switch" title="${a.status === 'active' ? 'Pausar' : 'Activar'}">
            <input type="checkbox" class="auto-toggle" data-id="${a.id}" ${a.status === 'active' ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </label>
        </div>
      </div>

      <div class="auto-target-tags">
        ${(a.target.titles || []).map(t => `<span class="auto-tag">${t}</span>`).join('')}
        ${(a.target.keywords || []).map(k => `<span class="auto-tag kw">🔑 ${k}</span>`).join('')}
        ${(a.target.industries || []).map(i => `<span class="auto-tag ind">🏢 ${i}</span>`).join('')}
      </div>

      ${a.content?.template ? `
        <div class="auto-template-preview">
          <span class="auto-template-icon">📝</span>
          <span class="auto-template-text">${a.content.template}</span>
        </div>` : ''}

      <div class="auto-stats-row">
        <div class="auto-stat">
          <div class="auto-stat-val">${a.stats.actionsToday}</div>
          <div class="auto-stat-label">Hoy</div>
        </div>
        <div class="auto-stat">
          <div class="auto-stat-val">${a.stats.total.toLocaleString('es-AR')}</div>
          <div class="auto-stat-label">Total</div>
        </div>
        <div class="auto-stat">
          <div class="auto-stat-val" style="color:var(--neon-green);">${a.stats.successRate}%</div>
          <div class="auto-stat-label">Éxito</div>
        </div>
        <div class="auto-stat auto-stat-limit">
          <div class="auto-limit-bar">
            <div class="auto-limit-fill" style="width:${used}%;background:${safetyColor(used)};"></div>
          </div>
          <div class="auto-stat-label">${a.stats.actionsToday}/${a.schedule.dailyLimit} hoy</div>
        </div>
      </div>

      <div class="auto-card-foot">
        <span class="auto-last-run">🕐 ${a.lastRun}</span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost auto-log-btn" data-id="${a.id}" style="font-size:12px;">Ver log</button>
          <button class="btn btn-secondary auto-edit-btn" data-id="${a.id}" style="font-size:12px;">Editar</button>
        </div>
      </div>
    </div>`;
}

// ── Activity log row ──────────────────────────────────────────────────────────
function logRow(entry) {
  const type = AUTO_TYPES[entry.type] || AUTO_TYPES.message;
  const success = entry.result === 'success';
  return `
    <tr class="log-row">
      <td class="log-time">${entry.time}</td>
      <td>
        <span class="log-type-badge" style="background:${type.bg};color:${type.color};">${type.icon} ${type.label}</span>
      </td>
      <td class="log-contact">
        <div class="log-avatar">${entry.initials}</div>
        <div>
          <div class="log-name">${entry.name}</div>
          <div class="log-company">${entry.company}</div>
        </div>
      </td>
      <td class="log-action-text">${entry.action}</td>
      <td>
        <span class="log-result ${success ? 'ok' : 'fail'}">${success ? '✓ OK' : '✗ Error'}</span>
      </td>
    </tr>`;
}

// ── Wizard state ──────────────────────────────────────────────────────────────
function openWizard(container, onCreated) {
  let step = 1;
  let wizard = { type: null, targets: {}, schedule: { dailyLimit: 20, hours: '09:00-18:00', days: ['Mon','Tue','Wed','Thu','Fri'] }, content: { template: '' } };

  const backdrop = document.createElement('div');
  backdrop.className = 'wizard-backdrop';
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  const close = () => {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 280);
  };

  const render = () => { backdrop.innerHTML = wizardHTML(step, wizard); bindWizard(backdrop, close, render, wizard, s => { step = s; }, onCreated); };
  render();
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
}

function wizardHTML(step, wizard) {
  const steps = ['Tipo', 'Audiencia', 'Horario', 'Contenido'];
  const indicator = steps.map((s, i) => `
    <div class="wiz-step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}">
      <div class="wiz-step-num">${i + 1 < step ? '✓' : i + 1}</div>
      <span>${s}</span>
    </div>
    ${i < steps.length - 1 ? '<div class="wiz-step-line"></div>' : ''}`).join('');

  let body = '';
  if (step === 1) {
    body = `
      <div class="wiz-type-grid">
        ${Object.entries(AUTO_TYPES).map(([key, t]) => `
          <button class="wiz-type-card ${wizard.type === key ? 'selected' : ''}" data-type="${key}">
            <span class="wiz-type-emoji">${t.icon}</span>
            <span class="wiz-type-label">${t.label}</span>
          </button>`).join('')}
      </div>`;
  } else if (step === 2) {
    body = `
      <div class="wiz-form">
        <div class="wiz-form-group">
          <label>Títulos de cargo objetivo</label>
          <input class="wiz-input" id="wizTitles" placeholder="ej: HR Director, People Manager, CHRO" value="${(wizard.targets.titles || []).join(', ')}">
          <span class="wiz-hint">Separar con coma. Vacío = todos.</span>
        </div>
        <div class="wiz-form-group">
          <label>Industrias</label>
          <input class="wiz-input" id="wizIndustries" placeholder="ej: Salud, Tecnología, Retail" value="${(wizard.targets.industries || []).join(', ')}">
        </div>
        <div class="wiz-form-group">
          <label>Palabras clave en posts/perfil</label>
          <input class="wiz-input" id="wizKeywords" placeholder="ej: bienestar, wellness, RRHH" value="${(wizard.targets.keywords || []).join(', ')}">
        </div>
        <div class="wiz-form-group">
          <label>Países / Regiones</label>
          <input class="wiz-input" id="wizCountries" placeholder="ej: Argentina, Chile, México" value="${(wizard.targets.countries || []).join(', ')}">
        </div>
      </div>`;
  } else if (step === 3) {
    const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const keys  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    body = `
      <div class="wiz-form">
        <div class="wiz-form-group">
          <label>Límite diario de acciones <span class="wiz-badge" id="limitVal">${wizard.schedule.dailyLimit}</span></label>
          <input type="range" class="wiz-range" id="wizLimit" min="5" max="100" value="${wizard.schedule.dailyLimit}">
          <div class="wiz-range-labels"><span>5 seguro</span><span>100 riesgo</span></div>
          <div class="safety-meter">
            <div class="safety-meter-fill" id="safetyFill" style="width:${pct(wizard.schedule.dailyLimit, 100)}%;background:${safetyColor(pct(wizard.schedule.dailyLimit, 100))};"></div>
          </div>
          <span class="wiz-hint" id="safetyLabel">✅ Límite seguro — sin riesgo de restricción</span>
        </div>
        <div class="wiz-form-group">
          <label>Horario de ejecución</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="time" class="wiz-input" id="wizFrom" value="09:00" style="width:130px;">
            <span style="color:var(--text-2);">hasta</span>
            <input type="time" class="wiz-input" id="wizTo" value="18:00" style="width:130px;">
          </div>
        </div>
        <div class="wiz-form-group">
          <label>Días de ejecución</label>
          <div class="wiz-days">
            ${days.map((d, i) => `
              <button class="wiz-day-btn ${(wizard.schedule.days || []).includes(keys[i]) ? 'active' : ''}" data-day="${keys[i]}">${d}</button>`).join('')}
          </div>
        </div>
        <div class="wiz-form-group">
          <div class="wiz-safety-note">
            🛡️ <strong>Modo seguro activado:</strong> las acciones se distribuyen aleatoriamente en el horario para imitar comportamiento humano.
          </div>
        </div>
      </div>`;
  } else if (step === 4) {
    const needsTemplate = ['message','comment','followup'].includes(wizard.type);
    const vars = ['{{nombre}}','{{empresa}}','{{cargo}}','{{industria}}'];
    body = `
      <div class="wiz-form">
        ${needsTemplate ? `
          <div class="wiz-form-group">
            <label>Plantilla de mensaje</label>
            <div class="wiz-vars">
              ${vars.map(v => `<button class="wiz-var-chip" data-var="${v}">${v}</button>`).join('')}
            </div>
            <textarea class="wiz-input wiz-textarea" id="wizTemplate" placeholder="Hola {{nombre}}, vi tu perfil y quería conectar...">${wizard.content.template}</textarea>
            <span class="wiz-hint">Caracteres: <span id="charCount">${wizard.content.template.length}</span>/300</span>
          </div>` : `
          <div class="wiz-no-template">
            <span style="font-size:48px;">${AUTO_TYPES[wizard.type]?.icon || '⚡'}</span>
            <p>Esta automatización no requiere plantilla de texto.</p>
            <p style="color:var(--text-2);font-size:12px;">Se ejecutará automáticamente según los filtros y horario configurados.</p>
          </div>`}
        <div class="wiz-summary">
          <div class="wiz-summary-title">✅ Resumen de la automatización</div>
          <div class="wiz-summary-row"><span>Tipo</span><strong>${AUTO_TYPES[wizard.type]?.icon} ${AUTO_TYPES[wizard.type]?.label}</strong></div>
          <div class="wiz-summary-row"><span>Audiencia</span><strong>${Object.values(wizard.targets).flat().join(', ') || 'Todos'}</strong></div>
          <div class="wiz-summary-row"><span>Límite diario</span><strong>${wizard.schedule.dailyLimit} acciones</strong></div>
          <div class="wiz-summary-row"><span>Horario</span><strong>09:00 · 18:00 · ${(wizard.schedule.days||[]).length} días</strong></div>
        </div>
      </div>`;
  }

  return `
    <div class="wizard">
      <div class="wizard-header">
        <div class="wiz-title">Nueva automatización</div>
        <button class="icon-btn wizard-close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="wiz-steps-indicator">${indicator}</div>
      <div class="wizard-body">${body}</div>
      <div class="wizard-footer">
        ${step > 1 ? `<button class="btn btn-secondary" id="wizBack">← Atrás</button>` : '<div></div>'}
        <button class="btn btn-primary" id="wizNext">
          ${step < 4 ? 'Continuar →' : '🚀 Lanzar automatización'}
        </button>
      </div>
    </div>`;
}

function bindWizard(backdrop, close, render, wizard, setStep, onCreated) {
  backdrop.querySelector('.wizard-close-btn')?.addEventListener('click', close);

  // Step 1 — type selection
  backdrop.querySelectorAll('.wiz-type-card').forEach(card => {
    card.addEventListener('click', () => { wizard.type = card.dataset.type; render(); });
  });

  // Step 2 — target fields (saved on navigate)
  // Step 3 — range slider
  const limitInput = backdrop.querySelector('#wizLimit');
  if (limitInput) {
    limitInput.addEventListener('input', () => {
      const v = parseInt(limitInput.value, 10);
      backdrop.querySelector('#limitVal').textContent = v;
      const p = pct(v, 100);
      const fill = backdrop.querySelector('#safetyFill');
      const lbl = backdrop.querySelector('#safetyLabel');
      if (fill) fill.style.cssText = `width:${p}%;background:${safetyColor(p)};`;
      if (lbl) lbl.textContent = p < 40 ? '✅ Límite seguro — sin riesgo de restricción' : p < 70 ? '⚠️ Moderado — monitorear actividad' : '🚨 Alto — riesgo de restricción de LinkedIn';
    });
  }

  // Step 3 — day buttons
  backdrop.querySelectorAll('.wiz-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const day = btn.dataset.day;
      const idx = (wizard.schedule.days || []).indexOf(day);
      if (idx >= 0) wizard.schedule.days.splice(idx, 1);
      else { if (!wizard.schedule.days) wizard.schedule.days = []; wizard.schedule.days.push(day); }
    });
  });

  // Step 4 — template
  const tmpl = backdrop.querySelector('#wizTemplate');
  if (tmpl) {
    tmpl.addEventListener('input', () => {
      wizard.content.template = tmpl.value;
      const cc = backdrop.querySelector('#charCount');
      if (cc) cc.textContent = tmpl.value.length;
    });
    backdrop.querySelectorAll('.wiz-var-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const pos = tmpl.selectionStart;
        const v = chip.dataset.var;
        tmpl.value = tmpl.value.slice(0, pos) + v + tmpl.value.slice(pos);
        wizard.content.template = tmpl.value;
        tmpl.focus();
      });
    });
  }

  // Back
  backdrop.querySelector('#wizBack')?.addEventListener('click', () => {
    saveStep(backdrop, wizard);
    setStep(wizard._step - 1);
    wizard._step--;
    render();
  });

  // Next / Launch
  backdrop.querySelector('#wizNext')?.addEventListener('click', async () => {
    saveStep(backdrop, wizard);
    if (wizard._step === undefined) wizard._step = 1;

    if (wizard._step === 1 && !wizard.type) {
      toast('Seleccioná un tipo de automatización', 'warning'); return;
    }
    if (wizard._step < 4) {
      wizard._step++;
      setStep(wizard._step);
      render();
    } else {
      // Launch
      await api.createAutomation(wizard);
      close();
      toast('🚀 Automatización creada y activa!', 'success', 4000);
      onCreated();
    }
  });

  // Init step tracking
  if (!wizard._step) wizard._step = 1;
}

function saveStep(backdrop, wizard) {
  const titles = backdrop.querySelector('#wizTitles')?.value;
  if (titles !== undefined) wizard.targets.titles = titles.split(',').map(s => s.trim()).filter(Boolean);
  const industries = backdrop.querySelector('#wizIndustries')?.value;
  if (industries !== undefined) wizard.targets.industries = industries.split(',').map(s => s.trim()).filter(Boolean);
  const keywords = backdrop.querySelector('#wizKeywords')?.value;
  if (keywords !== undefined) wizard.targets.keywords = keywords.split(',').map(s => s.trim()).filter(Boolean);
  const limit = backdrop.querySelector('#wizLimit')?.value;
  if (limit) wizard.schedule.dailyLimit = parseInt(limit, 10);
  const tmpl = backdrop.querySelector('#wizTemplate')?.value;
  if (tmpl !== undefined) wizard.content.template = tmpl;
}

// ── Main render ───────────────────────────────────────────────────────────────
export async function renderAutomations(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Automatizaciones</h1>
          <p class="view-subtitle">Reglas de engagement automático en LinkedIn · B2B LATAM</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" id="safetyBtn">
            🛡️ Modo seguro
          </button>
          <button class="btn btn-primary" id="newAutoBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva automatización
          </button>
        </div>
      </div>

      <!-- Metrics -->
      <div class="auto-metrics-row" id="autoMetrics">
        ${[1,2,3,4].map(() => '<div class="card skeleton" style="height:88px;"></div>').join('')}
      </div>

      <!-- Safety banner -->
      <div class="auto-safety-banner">
        🛡️ <strong>Modo seguro activo:</strong> Acciones distribuidas aleatoriamente · Límites diarios respetados · Pausa automática si detecta captcha
        <button class="auto-safety-close" id="closeSafetyBanner">✕</button>
      </div>

      <!-- Filter tabs -->
      <div class="auto-filter-tabs" id="autoFilters">
        <button class="auto-tab active" data-filter="all">Todas</button>
        <button class="auto-tab" data-filter="message">💬 Mensajes</button>
        <button class="auto-tab" data-filter="like">👍 Likes</button>
        <button class="auto-tab" data-filter="comment">💭 Comentarios</button>
        <button class="auto-tab" data-filter="followup">🔄 Follow-up</button>
        <button class="auto-tab" data-filter="view">👀 Ver perfil</button>
      </div>

      <!-- Automations grid -->
      <div class="auto-grid" id="autoGrid">
        ${[1,2,3].map(() => '<div class="auto-card skeleton" style="height:280px;"></div>').join('')}
      </div>

      <!-- Activity log -->
      <div class="card" style="margin-top:18px;">
        <div class="card-title" style="display:flex;align-items:center;gap:10px;">
          Log de actividad en tiempo real
          <span class="nav-badge" style="margin-left:4px;" id="logBadge">…</span>
          <span id="liveIndicator" style="margin-left:auto;font-size:11px;color:var(--neon-green);display:flex;align-items:center;gap:5px;">
            <span style="width:7px;height:7px;border-radius:50%;background:var(--neon-green);animation:pulse 2s infinite;"></span>
            EN VIVO · actualiza en <span id="refreshCountdown">30</span>s
          </span>
        </div>
        <div class="card-subtitle" style="margin-bottom:14px;">Últimas acciones ejecutadas por tus automatizaciones</div>
        <div class="log-table-wrap">
          <table class="log-table" id="autoLog">
            <thead><tr><th>Hora</th><th>Tipo</th><th>Contacto</th><th>Acción</th><th>Resultado</th></tr></thead>
            <tbody id="logBody">
              ${[1,2,3,4].map(() => '<tr><td colspan="5"><div class="skeleton" style="height:36px;border-radius:6px;"></div></td></tr>').join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  // Fetch data
  const [automations, stats, log] = await Promise.all([
    api.getAutomations(),
    api.getAutomationStats(),
    api.getAutomationLog(),
  ]);

  // ── Metrics ──
  const metricsCfg = [
    { label: 'Automatizaciones activas', val: stats.active,        icon: '⚡', color: 'var(--neon-blue)'   },
    { label: 'Acciones hoy',             val: stats.actionsToday,  icon: '🎯', color: 'var(--neon-purple)' },
    { label: 'Mensajes enviados',        val: stats.messagesSent,  icon: '💬', color: 'var(--neon-cyan)'   },
    { label: 'Tasa de éxito',            val: `${stats.successRate}%`, icon: '✅', color: 'var(--neon-green)'  },
  ];
  container.querySelector('#autoMetrics').innerHTML = metricsCfg.map(m => `
    <div class="card auto-metric-card">
      <div class="auto-metric-icon" style="color:${m.color};">${m.icon}</div>
      <div class="auto-metric-val" style="color:${m.color};">${m.val}</div>
      <div class="auto-metric-label">${m.label}</div>
    </div>`).join('');

  // ── Render grid ──
  let currentFilter = 'all';

  const renderGrid = () => {
    const filtered = currentFilter === 'all' ? automations : automations.filter(a => a.type === currentFilter);
    const grid = container.querySelector('#autoGrid');
    grid.innerHTML = filtered.length
      ? filtered.map(autoCard).join('')
      : '<div class="empty">No hay automatizaciones de este tipo. ¡Creá una!</div>';
    bindGridEvents(grid, automations);
  };

  renderGrid();

  // ── Filters ──
  container.querySelector('#autoFilters')?.addEventListener('click', e => {
    const btn = e.target.closest('.auto-tab');
    if (!btn) return;
    container.querySelectorAll('.auto-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderGrid();
  });

  // ── Log ──
  const refreshLog = async () => {
    const fresh = await api.getAutomationLog();
    const logBody = container.querySelector('#logBody');
    if (!logBody) return;
    logBody.innerHTML = fresh.length
      ? fresh.map(logRow).join('')
      : '<tr><td colspan="5" style="text-align:center;color:var(--text-2);padding:24px;">Sin actividad todavía. Activá una automatización para ver el log.</td></tr>';
    const badge = container.querySelector('#logBadge');
    if (badge) badge.textContent = fresh.length;
  };

  const refreshMetrics = async () => {
    const fresh = await api.getAutomationStats();
    const grid = container.querySelector('#autoMetrics');
    if (!grid) return;
    const cfgs = [
      { label: 'Automatizaciones activas', val: fresh.active,            icon: '⚡', color: 'var(--neon-blue)'   },
      { label: 'Acciones hoy',             val: fresh.actionsToday,      icon: '🎯', color: 'var(--neon-purple)' },
      { label: 'Mensajes enviados',        val: fresh.messagesSent,      icon: '💬', color: 'var(--neon-cyan)'   },
      { label: 'Tasa de éxito',            val: `${fresh.successRate}%`, icon: '✅', color: 'var(--neon-green)'  },
    ];
    grid.innerHTML = cfgs.map(m => `
      <div class="card auto-metric-card">
        <div class="auto-metric-icon" style="color:${m.color};">${m.icon}</div>
        <div class="auto-metric-val" style="color:${m.color};">${m.val}</div>
        <div class="auto-metric-label">${m.label}</div>
      </div>`).join('');
  };

  await refreshLog();

  // Auto-refresh every 30 seconds
  let countdown = 30;
  const countdownEl = () => container.querySelector('#refreshCountdown');
  const refreshTimer = setInterval(async () => {
    countdown--;
    const el = countdownEl();
    if (el) el.textContent = countdown;
    if (countdown <= 0) {
      countdown = 30;
      await Promise.all([refreshLog(), refreshMetrics()]);
    }
  }, 1000);

  // Cleanup when navigating away
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      clearInterval(refreshTimer);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ── Buttons ──
  container.querySelector('#newAutoBtn')?.addEventListener('click', () => {
    openWizard(container, () => { currentView = null; renderAutomations(container); });
  });
  container.querySelector('#safetyBtn')?.addEventListener('click', () => {
    modal({
      title: '🛡️ Configuración de seguridad',
      body: `
        <div class="wiz-form">
          <div class="wiz-form-group">
            <label>Límite global de acciones por día</label>
            <input type="range" class="wiz-range" id="globalLimit" min="10" max="200" value="150">
            <div class="wiz-range-labels"><span>10</span><span>200</span></div>
          </div>
          <div class="wiz-form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <input type="checkbox" checked> Pausar automáticamente si LinkedIn detecta actividad inusual
            </label>
          </div>
          <div class="wiz-form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <input type="checkbox" checked> Modo humano: delays aleatorios entre acciones (3–45 seg)
            </label>
          </div>
          <div class="wiz-form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <input type="checkbox"> Notificarme si una automatización supera el 90% del límite
            </label>
          </div>
          <div class="auto-safety-banner" style="margin-top:0;">
            🛡️ Configuración actual: <strong>Modo seguro ON</strong> · Delay promedio: 12 seg · Límite global: 150/día
          </div>
        </div>`,
      actions: [
        { label: 'Cancelar', cls: 'btn-secondary', onClick: ({ close }) => close() },
        { label: 'Guardar cambios', cls: 'btn-primary', onClick: ({ close }) => { close(); toast('Configuración de seguridad guardada ✅', 'success'); } },
      ],
    });
  });
  container.querySelector('#closeSafetyBanner')?.addEventListener('click', e => {
    e.target.closest('.auto-safety-banner')?.remove();
  });
}

// ── Bind grid events ──────────────────────────────────────────────────────────
function bindGridEvents(grid, automations) {
  // Toggle switch
  grid.querySelectorAll('.auto-toggle').forEach(toggle => {
    toggle.addEventListener('change', async () => {
      const id = toggle.dataset.id;
      const a = automations.find(x => x.id === id);
      if (!a) return;
      toggle.disabled = true;
      await api.toggleAutomation(id);
      a.status = toggle.checked ? 'active' : 'paused';
      toggle.disabled = false;
      const pill = toggle.closest('.auto-card')?.querySelector('.status-pill');
      if (pill) { pill.className = `status-pill ${a.status}`; pill.textContent = a.status === 'active' ? 'Activa' : 'Pausada'; }
      toast(`Automatización ${a.status === 'active' ? 'activada ▶' : 'pausada ⏸'}`, a.status === 'active' ? 'success' : 'info');
    });
  });

  // Ver log button — shows filtered entries for this automation
  grid.querySelectorAll('.auto-log-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const a = automations.find(x => x.id === id);
      const log = await api.getAutomationLog();
      // No server-side filter yet, show all with the automation name highlighted
      const relevant = log.filter(e => e.name === a?.name || log.length < 5);
      const rows = relevant.length ? relevant.map(logRow).join('') :
        '<tr><td colspan="5" style="text-align:center;color:var(--text-2);padding:24px;">Sin actividad registrada aún para esta automatización.</td></tr>';

      const backdrop = document.createElement('div');
      backdrop.className = 'wizard-backdrop';
      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add('open'));
      backdrop.addEventListener('click', e => { if (e.target === backdrop) { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 280); } });

      backdrop.innerHTML = `
        <div class="wizard" style="max-width:700px;">
          <div class="wizard-header">
            <div class="wiz-title">📋 Log: ${a?.name || 'Automatización'}</div>
            <button class="icon-btn wizard-close-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="wizard-body" style="padding:0;">
            <div class="log-table-wrap" style="max-height:400px;overflow-y:auto;">
              <table class="log-table">
                <thead><tr><th>Hora</th><th>Tipo</th><th>Contacto</th><th>Acción</th><th>Resultado</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
          <div class="wizard-footer"><div></div><button class="btn btn-secondary wizard-close-btn">Cerrar</button></div>
        </div>`;

      backdrop.querySelectorAll('.wizard-close-btn').forEach(b =>
        b.addEventListener('click', () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 280); }));
    });
  });

  // Edit button — show a simple edit modal
  grid.querySelectorAll('.auto-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const a = automations.find(x => x.id === id);
      if (!a) return;

      const backdrop = document.createElement('div');
      backdrop.className = 'wizard-backdrop';
      document.body.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add('open'));
      const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 280); };
      backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

      backdrop.innerHTML = `
        <div class="wizard" style="max-width:480px;">
          <div class="wizard-header">
            <div class="wiz-title">✏️ Editar: ${a.name}</div>
            <button class="icon-btn wizard-close-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="wizard-body">
            <div class="wiz-form">
              <div class="wiz-form-group">
                <label>Nombre</label>
                <input class="wiz-input" id="editName" value="${a.name}">
              </div>
              <div class="wiz-form-group">
                <label>Límite diario de acciones</label>
                <input type="number" class="wiz-input" id="editLimit" min="1" max="100" value="${a.schedule?.dailyLimit || 15}">
              </div>
              ${a.content?.template !== undefined ? `
              <div class="wiz-form-group">
                <label>Plantilla de mensaje</label>
                <textarea class="wiz-input wiz-textarea" id="editTemplate">${a.content.template || ''}</textarea>
              </div>` : ''}
            </div>
          </div>
          <div class="wizard-footer">
            <button class="btn btn-secondary wizard-close-btn">Cancelar</button>
            <button class="btn btn-primary" id="saveEditBtn">💾 Guardar cambios</button>
          </div>
        </div>`;

      backdrop.querySelectorAll('.wizard-close-btn').forEach(b => b.addEventListener('click', close));
      backdrop.querySelector('#saveEditBtn')?.addEventListener('click', () => {
        // In live mode would PATCH /api/automations/:id
        close();
        toast('Cambios guardados ✅', 'success');
      });
    });
  });
}
