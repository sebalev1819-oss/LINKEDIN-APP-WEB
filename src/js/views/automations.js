/**
 * src/js/views/automations.js
 * Vista completa de Automatizaciones — LinkedIn Manager
 * Tipos: like, comment, message, connection, view, followup, endorse
 */

import { API } from '../services/api.js';

// ── Config de tipos ────────────────────────────────────────────────────────────
const AUTO_TYPES = [
  {
    key: 'like',
    icon: '👍',
    label: 'Me Gusta',
    desc: 'Da like automáticamente a posts del feed de LinkedIn',
    color: '#0ea5e9',
    hasContent: false,
    targetMode: 'feed',
  },
  {
    key: 'comment',
    icon: '💬',
    label: 'Comentar',
    desc: 'Comenta posts con texto personalizado',
    color: '#8b5cf6',
    hasContent: true,
    contentLabel: 'Texto del comentario',
    contentPlaceholder: 'Excelente contenido, muy valioso para el sector! 🙌',
    targetMode: 'urls',
  },
  {
    key: 'message',
    icon: '✉️',
    label: 'Mensaje Directo',
    desc: 'Envía mensajes personalizados a perfiles',
    color: '#10b981',
    hasContent: true,
    contentLabel: 'Plantilla del mensaje',
    contentPlaceholder: 'Hola {nombre}, vi tu perfil y me interesa conectar. ¿Tienes 15 min esta semana?',
    targetMode: 'urls',
  },
  {
    key: 'connection',
    icon: '🤝',
    label: 'Conectar',
    desc: 'Envía solicitudes de conexión con nota opcional',
    color: '#f59e0b',
    hasContent: true,
    contentLabel: 'Nota de conexión (opcional, máx 300 caracteres)',
    contentPlaceholder: 'Hola {nombre}, me interesa lo que hacen en {empresa}. Me gustaría conectar.',
    targetMode: 'urls',
  },
  {
    key: 'view',
    icon: '👁️',
    label: 'Ver Perfiles',
    desc: 'Visita perfiles para generar visibilidad y notificaciones',
    color: '#ec4899',
    hasContent: false,
    targetMode: 'urls',
  },
  {
    key: 'followup',
    icon: '🔄',
    label: 'Follow-up',
    desc: 'Envía mensajes de seguimiento a contactos previos',
    color: '#14b8a6',
    hasContent: true,
    contentLabel: 'Mensaje de seguimiento',
    contentPlaceholder: 'Hola {nombre}, quería retomar nuestro contacto. ¿Cómo va todo?',
    targetMode: 'urls',
  },
  {
    key: 'endorse',
    icon: '⭐',
    label: 'Endorse Skills',
    desc: 'Avala habilidades de tus contactos automáticamente',
    color: '#f97316',
    hasContent: false,
    targetMode: 'urls',
  },
];

// Wizard state
let wizardStep = 1;
let wizardData = { type: null, targets: [], content: '', dailyLimit: 20, schedule: 'all' };
let automations = [];
let logEntries = [];
let refreshInterval = null;

// ── Render principal ───────────────────────────────────────────────────────────
export async function renderAutomations(container) {
  container.innerHTML = buildShell();
  attachShellEvents();
  await loadData();
  startAutoRefresh();
}

function buildShell() {
  return `
    <div class="auto-page">
      <!-- Header -->
      <div class="auto-header">
        <div>
          <h1 class="auto-title">
            <span class="auto-title-icon">⚡</span>
            Automatizaciones
          </h1>
          <p class="auto-subtitle">Engagement automático en LinkedIn · activas 24/7</p>
        </div>
        <button class="btn btn-primary btn-lg" id="newAutoBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Automatización
        </button>
      </div>

      <!-- Stats bar -->
      <div class="auto-stats" id="autoStats">
        <div class="auto-stat-card">
          <div class="auto-stat-icon" style="background:rgba(14,165,233,0.15);color:#0ea5e9">⚡</div>
          <div>
            <div class="auto-stat-value" id="statActive">—</div>
            <div class="auto-stat-label">Activas</div>
          </div>
        </div>
        <div class="auto-stat-card">
          <div class="auto-stat-icon" style="background:rgba(16,185,129,0.15);color:#10b981">📊</div>
          <div>
            <div class="auto-stat-value" id="statToday">—</div>
            <div class="auto-stat-label">Acciones hoy</div>
          </div>
        </div>
        <div class="auto-stat-card">
          <div class="auto-stat-icon" style="background:rgba(139,92,246,0.15);color:#8b5cf6">💬</div>
          <div>
            <div class="auto-stat-value" id="statMsgs">—</div>
            <div class="auto-stat-label">Mensajes enviados</div>
          </div>
        </div>
        <div class="auto-stat-card">
          <div class="auto-stat-icon" style="background:rgba(245,158,11,0.15);color:#f59e0b">🎯</div>
          <div>
            <div class="auto-stat-value" id="statRate">—</div>
            <div class="auto-stat-label">Tasa de éxito</div>
          </div>
        </div>
      </div>

      <!-- Automations list -->
      <div class="auto-section">
        <h2 class="auto-section-title">Reglas configuradas</h2>
        <div class="auto-list" id="autoList">
          <div class="auto-loading">
            <div class="spinner"></div>
            <span>Cargando automatizaciones...</span>
          </div>
        </div>
      </div>

      <!-- Live activity log -->
      <div class="auto-section">
        <div class="auto-log-header">
          <h2 class="auto-section-title">Actividad reciente</h2>
          <span class="live-badge">● LIVE</span>
        </div>
        <div class="auto-log" id="autoLog">
          <div class="auto-loading"><div class="spinner"></div><span>Cargando log...</span></div>
        </div>
      </div>
    </div>

    <!-- Modal wizard -->
    <div class="modal-overlay" id="autoModal" style="display:none">
      <div class="modal-box modal-lg" id="autoModalBox">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">Nueva Automatización</h2>
            <div class="wizard-steps" id="wizardSteps">
              <span class="wizard-step active" data-step="1">1. Tipo</span>
              <span class="wizard-sep">›</span>
              <span class="wizard-step" data-step="2">2. Targets</span>
              <span class="wizard-sep">›</span>
              <span class="wizard-step" data-step="3">3. Contenido</span>
              <span class="wizard-sep">›</span>
              <span class="wizard-step" data-step="4">4. Horario</span>
            </div>
          </div>
          <button class="modal-close" id="closeAutoModal">✕</button>
        </div>
        <div class="modal-body" id="wizardBody">
          <!-- injected per step -->
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="wizardBack" style="display:none">← Atrás</button>
          <button class="btn btn-primary" id="wizardNext">Siguiente →</button>
        </div>
      </div>
    </div>
  `;
}

// ── Shell events ───────────────────────────────────────────────────────────────
function attachShellEvents() {
  document.getElementById('newAutoBtn').addEventListener('click', openWizard);
  document.getElementById('closeAutoModal').addEventListener('click', closeWizard);
  document.getElementById('wizardNext').addEventListener('click', wizardNext);
  document.getElementById('wizardBack').addEventListener('click', wizardPrev);

  document.getElementById('autoModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('autoModal')) closeWizard();
  });
}

// ── Data load ──────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [stats, autos, log] = await Promise.all([
      API.get('/api/automations/stats').catch(() => ({})),
      API.get('/api/automations').catch(() => []),
      API.get('/api/automations/log').catch(() => []),
    ]);
    renderStats(stats);
    automations = Array.isArray(autos) ? autos : [];
    logEntries = Array.isArray(log) ? log : [];
    renderAutomationList();
    renderLog();
  } catch (err) {
    console.error('[Automations] loadData error:', err);
    renderAutomationList();
    renderLog();
  }
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(async () => {
    try {
      const [stats, log] = await Promise.all([
        API.get('/api/automations/stats').catch(() => null),
        API.get('/api/automations/log').catch(() => null),
      ]);
      if (stats) renderStats(stats);
      if (log) { logEntries = log; renderLog(); }
    } catch {}
  }, 15000);
}

// ── Render stats ───────────────────────────────────────────────────────────────
function renderStats(s) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statActive', s.active ?? '—');
  set('statToday', s.actionsToday ?? '—');
  set('statMsgs', s.messagesSent ?? '—');
  set('statRate', s.successRate != null ? \`\${s.successRate}%\` : '—');
}

// ── Render automation list ─────────────────────────────────────────────────────
function renderAutomationList() {
  const el = document.getElementById('autoList');
  if (!el) return;

  if (!automations.length) {
    el.innerHTML = \`
      <div class="auto-empty">
        <div class="auto-empty-icon">⚡</div>
        <h3>No hay automatizaciones configuradas</h3>
        <p>Creá tu primera regla de engagement automático en LinkedIn</p>
        <button class="btn btn-primary" id="emptyNewAutoBtn">+ Nueva Automatización</button>
      </div>\`;
    document.getElementById('emptyNewAutoBtn')?.addEventListener('click', openWizard);
    return;
  }

  el.innerHTML = automations.map(a => buildAutoCard(a)).join('');

  el.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => toggleAuto(btn.dataset.toggle));
  });
  el.querySelectorAll('[data-run]').forEach(btn => {
    btn.addEventListener('click', () => runAutoNow(btn.dataset.run));
  });
  el.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteAuto(btn.dataset.delete));
  });
}

buildAutoCard(a) {
  const typeInfo = AUTO_TYPES.find(t => t.key === a.type) || { icon: '⚙️', label: a.type, color: '#6b7280' };
  const isActive = a.status === 'active';
  const pct = a.stats?.successRate || 0;

  return \`
    <div class="auto-card \${isActive ? 'auto-card--active' : 'auto-card--paused'}\">
      <div class="auto-card-left">
        <div class="auto-type-badge" style="background:\${typeInfo.color}22;color:\${typeInfo.color};border:1px solid \${typeInfo.color}44">
          \${typeInfo.icon} \${typeInfo.label}
        </div>
        <h3 class="auto-card-name">\${escHtml(a.name)}</h3>
        <div class="auto-card-meta">
          <span class="auto-card-status \${isActive ? 'status--active' : 'status--paused'}\">
            \${isActive ? '● Activa' : '⏸ Pausada'}
          </span>
          <span class="auto-card-lastrun">Última ejecución: \${a.lastRun || 'Nunca'}</span>
        </div>
      </div>

      <div class="auto-card-stats">
        <div class="auto-card-stat">
          <span class="auto-card-stat-val">\${a.stats?.actionsToday || 0}</span>
          <span class="auto-card-stat-lbl">hoy</span>
        </div>
        <div class="auto-card-stat">
          <span class="auto-card-stat-val">\${a.stats?.total || 0}</span>
          <span class="auto-card-stat-lbl">total</span>
        </div>
        <div class="auto-card-stat">
          <span class="auto-card-stat-val">\${pct}%</span>
          <span class="auto-card-stat-lbl">éxito</span>
        </div>
      </div>

      <div class="auto-card-progress">
        <div class="auto-card-progress-bar" style="width:\${pct}%;background:\${typeInfo.color}\"></div>
      </div>

      <div class="auto-card-actions">
        <button class="btn btn-sm \${isActive ? 'btn-ghost' : 'btn-primary'}\" data-toggle=\"\${a.id}\">
          \${isActive ? '⏸ Pausar' : '▶ Activar'}
        </button>
        <button class="btn btn-sm btn-ghost" data-run=\"\${a.id}\">
          ▶▶ Ahora
        </button>
        <button class="btn btn-sm btn-danger-ghost" data-delete=\"\${a.id}\">
          🗑
        </button>
      </div>
    </div>\`;
}

// ── Render log ─────────────────────────────────────────────────────────────────
function renderLog() {
  const el = document.getElementById('autoLog');
  if (!el) return;

  if (!logEntries.length) {
    el.innerHTML = \`<div class="auto-log-empty">Sin actividad registrada aún. Las acciones aparecerán aquí en tiempo real.</div>\`;
    return;
  }

  const typeColors = {
    like_post: '#0ea5e9', comment_post: '#8b5cf6', send_message: '#10b981',
    connection_request: '#f59e0b', view_profile: '#ec4899',
    endorse_skill: '#f97316', publish_post: '#14b8a6',
  };

  el.innerHTML = logEntries.map(entry => {
    const color = typeColors[entry.type] || '#6b7280';
    const resultIcon = entry.result === 'success' ? '✅' : '❌';
    return \`
      <div class="auto-log-entry">
        <div class="auto-log-avatar" style="background:\${color}22;color:\${color}">
          \${entry.initials || '??'}
        </div>
        <div class="auto-log-info">
          <span class="auto-log-name">\${escHtml(entry.name || 'Acción')}</span>
          \${entry.company ? \`<span class="auto-log-company">· \${escHtml(entry.company)}</span>\` : ''}
          <span class="auto-log-action">\${escHtml(entry.action || entry.type)}</span>
        </div>
        <div class="auto-log-right">
          <span class="auto-log-result">\${resultIcon}</span>
          <span class="auto-log-time">\${entry.time || ''}</span>
        </div>
      </div>\`;
  }).join('');
}

// ── Actions ────────────────────────────────────────────────────────────────────
async function toggleAuto(id) {
  try {
    const res = await API.post(\`/api/automations/\${id}/toggle\`);
    showToast(res.status === 'active' ? '▶ Automatización activada' : '⏸ Automatización pausada', 'success');
    await loadData();
  } catch { showToast('Error al cambiar estado', 'error'); }
}

async function runAutoNow(id) {
  const btn = document.querySelector(\`[data-run="\${id}"]\`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    const res = await API.post(\`/api/automations/\${id}/run\`);
    if (res.ok) showToast('✅ Automatización ejecutada', 'success');
    else showToast(res.error || 'Sin cuentas conectadas', 'warning');
    await loadData();
  } catch { showToast('Error. ¿Está el backend activo?', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '▶▶ Ahora'; } }
}

async function deleteAuto(id) {
  if (!confirm('¿Eliminar esta automatización?')) return;
  try {
    await API.delete(\`/api/automations/\${id}\`);
    showToast('🗑 Eliminada', 'info');
    automations = automations.filter(a => a.id !== id);
    renderAutomationList();
  } catch { showToast('Error al eliminar', 'error'); }
}

// ── Wizard ─────────────────────────────────────────────────────────────────────
function openWizard() {
  wizardStep = 1;
  wizardData = { type: null, targets: [], content: '', dailyLimit: 20, schedule: 'all' };
  document.getElementById('autoModal').style.display = 'flex';
  renderWizardStep();
}

function closeWizard() {
  document.getElementById('autoModal').style.display = 'none';
}

function renderWizardStep() {
  const body = document.getElementById('wizardBody');
  const backBtn = document.getElementById('wizardBack');
  const nextBtn = document.getElementById('wizardNext');

  document.querySelectorAll('.wizard-step').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step) === wizardStep);
    s.classList.toggle('done', parseInt(s.dataset.step) < wizardStep);
  });

  backBtn.style.display = wizardStep > 1 ? 'inline-flex' : 'none';

  switch (wizardStep) {
    case 1:
      body.innerHTML = renderStep1();
      nextBtn.textContent = 'Siguiente →';
      if (wizardData.type) document.querySelector(\`[data-type="\${wizardData.type}"]\`)?.classList.add('type-selected');
      body.querySelectorAll('.type-card').forEach(card => {
        card.addEventListener('click', () => {
          body.querySelectorAll('.type-card').forEach(c => c.classList.remove('type-selected'));
          card.classList.add('type-selected');
          wizardData.type = card.dataset.type;
        });
      });
      break;

    case 2:
      body.innerHTML = renderStep2();
      nextBtn.textContent = 'Siguiente →';
      const typeInfo2 = AUTO_TYPES.find(t => t.key === wizardData.type);
      if (typeInfo2?.targetMode === 'feed') document.getElementById('targetUrls')?.setAttribute('disabled', 'true');
      break;

    case 3:
      const typeInfo3 = AUTO_TYPES.find(t => t.key === wizardData.type);
      if (!typeInfo3?.hasContent) { wizardStep++; renderWizardStep(); return; }
      body.innerHTML = renderStep3();
      nextBtn.textContent = 'Siguiente →';
      break;

    case 4:
      body.innerHTML = renderStep4();
      nextBtn.textContent = '✅ Crear Automatización';
      const slider = document.getElementById('dailyLimitSlider');
      const sliderVal = document.getElementById('dailyLimitVal');
      if (slider) {
        slider.value = wizardData.dailyLimit;
        sliderVal.textContent = wizardData.dailyLimit;
        slider.addEventListener('input', () => { wizardData.dailyLimit = parseInt(slider.value); sliderVal.textContent = slider.value; });
      }
      break;
  }
}

function renderStep1() {
  return \`
    <div class="wizard-step-content">
      <h3 class="wizard-step-title">¿Qué querés automatizar?</h3>
      <p class="wizard-step-hint">Elegí el tipo de acción que se ejecutará automáticamente en LinkedIn</p>
      <div class="type-grid">
        \${AUTO_TYPES.map(t => \`
          <div class="type-card \${wizardData.type === t.key ? 'type-selected' : ''}\" data-type=\"\${t.key}\">
            <div class="type-card-icon" style="background:\${t.color}22;color:\${t.color}">\${t.icon}</div>
            <div class="type-card-label">\${t.label}</div>
            <div class="type-card-desc">\${t.desc}</div>
          </div>\`).join('')}
      </div>
    </div>\`;
}

function renderStep2() {
  const typeInfo = AUTO_TYPES.find(t => t.key === wizardData.type);
  const isFeed = typeInfo?.targetMode === 'feed';
  return \`
    <div class="wizard-step-content">
      <h3 class="wizard-step-title">¿A quiénes apunta?</h3>
      \${isFeed ? \`<div class="info-banner"><span>ℹ️</span><span>Esta automatización actúa sobre el <strong>feed de LinkedIn</strong>. No necesitás especificar URLs.</span></div>\`
        : \`<p class="wizard-step-hint">URLs de perfiles de LinkedIn, una por línea</p>
           <textarea id="targetUrls" class="form-textarea" rows="7" placeholder="https://www.linkedin.com/in/nombre-apellido/">\${wizardData.targets.join('\\n')}</textarea>
           <div class="form-hint">Podés pegar hasta 50 URLs. Se procesan respetando el límite diario.</div>\`}
    </div>\`;
}

function renderStep3() {
  const typeInfo = AUTO_TYPES.find(t => t.key === wizardData.type);
  return \`
    <div class="wizard-step-content">
      <h3 class="wizard-step-title">\${typeInfo?.contentLabel || 'Contenido'}</h3>
      <p class="wizard-step-hint">Usá <code>{nombre}</code> y <code>{empresa}</code> como variables</p>
      <textarea id="contentTemplate" class="form-textarea" rows="6" placeholder="\${typeInfo?.contentPlaceholder || ''}">\${wizardData.content}</textarea>
      <div class="form-hint">Variables: <code>{nombre}</code> · <code>{empresa}</code> · <code>{cargo}</code>\${typeInfo?.key === 'connection' ? '<br>Límite: 300 caracteres' : ''}</div>
    </div>\`;
}

function renderStep4() {
  return \`
    <div class="wizard-step-content">
      <h3 class="wizard-step-title">Horario y límites</h3>
      <p class="wizard-step-hint">Cuántas acciones ejecutar por día y en qué horario</p>
      <div class="form-group">
        <label class="form-label">Límite diario: <strong id="dailyLimitVal">\${wizardData.dailyLimit}</strong></label>
        <input type="range" id="dailyLimitSlider" class="form-range" min="1" max="50" value="\${wizardData.dailyLimit}" />
        <div class="range-labels"><span>1 (seguro)</span><span>50 (rápido)</span></div>
        <div class="form-hint">⚠️ Recomendamos máximo 20/día</div>
      </div>
      <div class="form-group">
        <label class="form-label">Horario</label>
        <div class="schedule-options">
          <label class="schedule-opt \${wizardData.schedule === 'morning' ? 'selected' : ''}\">
            <input type="radio" name="schedule" value="morning" \${wizardData.schedule === 'morning' ? 'checked' : ''} />
            <span class="schedule-opt-icon">🌅</span><span>Mañana</span><span class="schedule-opt-time">8:00–12:00</span>
          </label>
          <label class="schedule-opt \${wizardData.schedule === 'afternoon' ? 'selected' : ''}\">
            <input type="radio" name="schedule" value="afternoon" \${wizardData.schedule === 'afternoon' ? 'checked' : ''} />
            <span class="schedule-opt-icon">☀️</span><span>Tarde</span><span class="schedule-opt-time">12:00–18:00</span>
          </label>
          <label class="schedule-opt \${wizardData.schedule === 'all' ? 'selected' : ''}\">
            <input type="radio" name="schedule" value="all" \${wizardData.schedule === 'all' ? 'checked' : ''} />
            <span class="schedule-opt-icon">🔄</span><span>Todo el día</span><span class="schedule-opt-time">7:00–22:00</span>
          </label>
        </div>
      </div>
    </div>\`;
}

async function wizardNext() {
  if (wizardStep === 1 && !wizardData.type) { showToast('Elegí un tipo de automatización', 'warning'); return; }

  if (wizardStep === 2) {
    const typeInfo = AUTO_TYPES.find(t => t.key === wizardData.type);
    if (typeInfo?.targetMode === 'urls') {
      const raw = document.getElementById('targetUrls')?.value || '';
      wizardData.targets = raw.split('\\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      if (!wizardData.targets.length) { showToast('Ingresá al menos una URL de LinkedIn', 'warning'); return; }
    }
  }

  if (wizardStep === 3) {
    const val = document.getElementById('contentTemplate')?.value || '';
    wizardData.content = val.trim();
    if (!wizardData.content) { showToast('Escribí el contenido', 'warning'); return; }
  }

  if (wizardStep === 4) {
    const sel = document.querySelector('input[name="schedule"]:checked');
    wizardData.schedule = sel?.value || 'all';
    await saveAutomation();
    return;
  }

  wizardStep++;
  renderWizardStep();
}

function wizardPrev() {
  if (wizardStep > 1) { wizardStep--; renderWizardStep(); }
}

async function saveAutomation() {
  const btn = document.getElementById('wizardNext');
  btn.disabled = true; btn.textContent = '⏳ Creando...';
  try {
    const payload = {
      type: wizardData.type,
      targets: { profileUrls: wizardData.targets },
      content: { template: wizardData.content },
      schedule: { dailyLimit: wizardData.dailyLimit, window: wizardData.schedule },
    };
    const res = await API.post('/api/automations', payload);
    if (res.id) {
      showToast('✅ Automatización creada', 'success');
      closeWizard();
      automations.unshift(res);
      renderAutomationList();
      const stats = await API.get('/api/automations/stats').catch(() => null);
      if (stats) renderStats(stats);
    } else {
      showToast(res.error || 'Error al crear', 'error');
    }
  } catch { showToast('Error de conexión con el backend', 'error'); }
  finally { btn.disabled = false; btn.textContent = '✅ Crear Automatización'; }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#0ea5e9' };
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = \`border-left:4px solid \${colors[type]||colors.info}\`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast--show'), 10);
  setTimeout(() => { toast.classList.remove('toast--show'); setTimeout(() => toast.remove(), 300); }, 3500);
}
