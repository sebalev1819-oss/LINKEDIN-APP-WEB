/**
 * src/js/views/accounts.js
 * LinkedIn Manager — Gestión de cuentas LinkedIn (cookie/sesión)
 * Método B: cookie li_at — como Waalaxy, Phantombuster, Dux-Soup.
 */
import * as api from '../services/api.js';
import { toast } from '../ui.js';

// ── Health color ──────────────────────────────────────────────────────────────
function healthColor(pct) {
  return pct >= 80 ? 'var(--neon-green)' : pct >= 50 ? 'var(--neon-amber)' : 'var(--neon-red)';
}

function healthLabel(pct) {
  return pct >= 80 ? '✅ Sesión saludable' : pct >= 50 ? '⚠️ Sesión degradada' : '🚨 Sesión en riesgo';
}

// ── Account card ──────────────────────────────────────────────────────────────
function accountCard(acc) {
  const hColor  = healthColor(acc.sessionHealth);
  const hLabel  = healthLabel(acc.sessionHealth);
  const usedPct = Math.min(Math.round((acc.limits.used / acc.limits.daily) * 100), 100);
  const limitColor = usedPct >= 85 ? 'var(--neon-red)' : usedPct >= 60 ? 'var(--neon-amber)' : 'var(--neon-green)';

  return `
    <div class="acc-card ${acc.status}" data-id="${acc.id}">
      <div class="acc-card-head">
        <div class="acc-avatar-wrap">
          <div class="acc-avatar">${acc.initials}</div>
          <span class="acc-status-dot ${acc.status}"></span>
        </div>
        <div class="acc-info">
          <div class="acc-name">${acc.name}</div>
          <div class="acc-headline">${acc.headline}</div>
          <div class="acc-connected">Conectada el ${acc.connectedAt}</div>
        </div>
        <div class="acc-head-actions">
          <button class="btn btn-ghost acc-disconnect-btn" data-id="${acc.id}" style="font-size:12px;color:var(--neon-red);">Desconectar</button>
        </div>
      </div>

      <!-- Session health -->
      <div class="acc-health-row">
        <div class="acc-health-label" style="color:${hColor};">${hLabel}</div>
        <div class="acc-health-bar">
          <div class="acc-health-fill" style="width:${acc.sessionHealth}%;background:${hColor};"></div>
        </div>
        <div class="acc-health-detail">
          <span>Cookie válida · ${acc.cookieExpiry}</span>
          <span style="color:${hColor};font-weight:700;">${acc.sessionHealth}%</span>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="acc-stats-grid">
        <div class="acc-stat">
          <div class="acc-stat-val">${acc.stats.actionsToday}</div>
          <div class="acc-stat-label">Acciones hoy</div>
        </div>
        <div class="acc-stat">
          <div class="acc-stat-val">${acc.stats.actionsWeek}</div>
          <div class="acc-stat-label">Esta semana</div>
        </div>
        <div class="acc-stat">
          <div class="acc-stat-val">${acc.stats.postsPublished}</div>
          <div class="acc-stat-label">Posts publicados</div>
        </div>
        <div class="acc-stat">
          <div class="acc-stat-val">${acc.stats.connectionsThisMonth}</div>
          <div class="acc-stat-label">Conexiones / mes</div>
        </div>
      </div>

      <!-- Daily limit bar -->
      <div class="acc-limit-section">
        <div class="acc-limit-header">
          <span>Límite diario</span>
          <span style="color:${limitColor};font-weight:700;">${acc.limits.used} / ${acc.limits.daily} acciones</span>
        </div>
        <div class="acc-limit-bar">
          <div class="acc-limit-fill" style="width:${usedPct}%;background:${limitColor};"></div>
        </div>
      </div>

      <!-- Actions -->
      <div class="acc-card-foot">
        <button class="btn btn-secondary acc-refresh-btn" data-id="${acc.id}" style="font-size:12px;">🔄 Renovar cookie</button>
        <button class="btn btn-primary" data-id="${acc.id}" style="font-size:12px;">⚡ Ver actividad</button>
      </div>
    </div>`;
}

// ── Connect modal ─────────────────────────────────────────────────────────────
function openConnectModal(onConnected) {
  let step = 1;
  const backdrop = document.createElement('div');
  backdrop.className = 'wizard-backdrop';
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 280); };

  const render = (s) => {
    step = s;
    backdrop.innerHTML = connectModalHTML(step);
    bindConnectModal(backdrop, close, render, onConnected);
  };

  render(1);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
}

function connectModalHTML(step) {
  const steps = ['Extraer cookie', 'Pegar & verificar', 'Listo'];

  const indicator = steps.map((s, i) => `
    <div class="wiz-step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}">
      <div class="wiz-step-num">${i + 1 < step ? '✓' : i + 1}</div>
      <span>${s}</span>
    </div>
    ${i < steps.length - 1 ? '<div class="wiz-step-line"></div>' : ''}`).join('');

  let body = '';

  if (step === 1) {
    body = `
      <div class="connect-guide">
        <p class="connect-intro">Conectá tu cuenta de LinkedIn usando la cookie de sesión <code>li_at</code>. Este es el mismo método que usa <strong>Waalaxy</strong>, <strong>Phantombuster</strong> y <strong>Dux-Soup</strong>.</p>
        <div class="connect-steps">
          <div class="connect-step">
            <div class="connect-step-num">1</div>
            <div class="connect-step-body">
              <strong>Abrí LinkedIn en tu navegador</strong>
              <p>Asegurate de estar logueado en la cuenta que querés conectar.</p>
            </div>
          </div>
          <div class="connect-step">
            <div class="connect-step-num">2</div>
            <div class="connect-step-body">
              <strong>Abrí las DevTools</strong>
              <p>Presioná <kbd>F12</kbd> (Windows) o <kbd>Cmd+Option+I</kbd> (Mac)</p>
            </div>
          </div>
          <div class="connect-step">
            <div class="connect-step-num">3</div>
            <div class="connect-step-body">
              <strong>Navegá a Application → Cookies</strong>
              <p>En el panel, hacé click en <strong>Application</strong> (o Storage) → <strong>Cookies</strong> → <code>https://www.linkedin.com</code></p>
            </div>
          </div>
          <div class="connect-step">
            <div class="connect-step-num">4</div>
            <div class="connect-step-body">
              <strong>Buscá la cookie <code>li_at</code></strong>
              <p>Copiá el valor completo (columna "Value"). Suele empezar con <code>AQE...</code></p>
            </div>
          </div>
        </div>
        <div class="connect-warning">
          🛡️ Tu cookie se almacena localmente y nunca se envía a servidores de terceros. Tratala como una contraseña.
        </div>
      </div>`;
  } else if (step === 2) {
    body = `
      <div class="wiz-form">
        <div class="wiz-form-group">
          <label>Nombre de la cuenta (opcional)</label>
          <input class="wiz-input" id="accName" placeholder="ej: Sebastián Levin">
        </div>
        <div class="wiz-form-group">
          <label>Cookie <code>li_at</code> de LinkedIn</label>
          <textarea class="wiz-input wiz-textarea" id="liAtCookie" placeholder="AQEDATxxxxxxx..." style="min-height:80px;font-family:monospace;font-size:12px;"></textarea>
          <span class="wiz-hint">El valor empieza típicamente con "AQE" y tiene varios cientos de caracteres.</span>
        </div>
        <div class="connect-warning" style="margin-top:0;">
          🔐 La cookie es válida mientras tu sesión de LinkedIn esté activa (normalmente 60-90 días).
        </div>
      </div>`;
  } else if (step === 3) {
    body = `
      <div class="connect-success">
        <div class="connect-success-icon">✅</div>
        <h3>¡Cuenta conectada!</h3>
        <p>La sesión de LinkedIn fue verificada correctamente. Podés empezar a automatizar ahora.</p>
        <div class="connect-success-chips">
          <span class="connect-chip">💬 Mensajes automáticos</span>
          <span class="connect-chip">👍 Likes a posts</span>
          <span class="connect-chip">📝 Publicaciones programadas</span>
          <span class="connect-chip">🔄 Follow-ups</span>
          <span class="connect-chip">👀 Ver perfiles</span>
        </div>
      </div>`;
  }

  return `
    <div class="wizard">
      <div class="wizard-header">
        <div class="wiz-title">Conectar cuenta LinkedIn</div>
        <button class="icon-btn wizard-close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="wiz-steps-indicator">${indicator}</div>
      <div class="wizard-body">${body}</div>
      <div class="wizard-footer">
        ${step > 1 && step < 3 ? `<button class="btn btn-secondary" id="connBack">← Atrás</button>` : '<div></div>'}
        ${step < 3
          ? `<button class="btn btn-primary" id="connNext">${step === 1 ? 'Ya extraje la cookie →' : '🔍 Verificar sesión'}</button>`
          : `<button class="btn btn-primary" id="connDone">Ir a Automatizaciones →</button>`}
      </div>
    </div>`;
}

function bindConnectModal(backdrop, close, render, onConnected) {
  backdrop.querySelector('.wizard-close-btn')?.addEventListener('click', close);

  backdrop.querySelector('#connBack')?.addEventListener('click', () => render(1));

  backdrop.querySelector('#connNext')?.addEventListener('click', async () => {
    const liAtInput = backdrop.querySelector('#liAtCookie');

    // Step 1: textarea doesn't exist yet → just advance to step 2
    if (!liAtInput) {
      render(2);
      return;
    }

    // Step 2: validate cookie and connect
    const cookie = liAtInput.value?.trim();
    if (!cookie) { toast('Pegá la cookie li_at para continuar', 'warning'); return; }
    if (cookie.length < 50) { toast('La cookie parece muy corta. Verificá que copiaste el valor completo.', 'warning'); return; }

    const btn = backdrop.querySelector('#connNext');
    btn.disabled = true;
    btn.textContent = '🔍 Verificando sesión...';

    try {
      await api.connectAccount({
        cookie,
        name: backdrop.querySelector('#accName')?.value?.trim() || 'Mi cuenta',
      });
      render(3);
      onConnected();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '🔍 Verificar sesión';
      toast(`Error: ${err.message}`, 'error', 6000);
    }
  });

  backdrop.querySelector('#connDone')?.addEventListener('click', () => { close(); });
}


// ── Main render ───────────────────────────────────────────────────────────────
export async function renderAccounts(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Cuentas LinkedIn</h1>
          <p class="view-subtitle">Gestión de sesiones conectadas · Automatización por cookie de sesión</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="connectNewBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Conectar cuenta
          </button>
        </div>
      </div>

      <!-- How it works banner -->
      <div class="acc-how-banner">
        <div class="acc-how-item"><span class="acc-how-icon">🍪</span><div><strong>Cookie de sesión</strong><p>Usa tu cookie <code>li_at</code> para autenticar automáticamente</p></div></div>
        <div class="acc-how-item"><span class="acc-how-icon">🤖</span><div><strong>Automatización real</strong><p>Mensajes, likes, comentarios, publicaciones — todo desde LinkedIn</p></div></div>
        <div class="acc-how-item"><span class="acc-how-icon">🛡️</span><div><strong>Modo seguro</strong><p>Delays aleatorios y límites diarios para imitar comportamiento humano</p></div></div>
        <div class="acc-how-item"><span class="acc-how-icon">👥</span><div><strong>Multi-cuenta</strong><p>Conectá varias cuentas para escalar tu alcance</p></div></div>
      </div>

      <div class="acc-grid" id="accGrid">
        <div class="acc-card skeleton" style="min-height:340px;"></div>
      </div>

      <!-- No accounts empty state (hidden by default) -->
      <div class="acc-empty" id="accEmpty" style="display:none;">
        <div style="font-size:64px;margin-bottom:16px;">🔗</div>
        <h2>Sin cuentas conectadas</h2>
        <p>Conectá tu primera cuenta de LinkedIn para empezar a automatizar mensajes, likes, publicaciones y más.</p>
        <button class="btn btn-primary" id="connectEmptyBtn" style="margin-top:16px;">Conectar mi primera cuenta</button>
      </div>
    </div>`;

  const accounts = await api.getAccounts();
  const grid = container.querySelector('#accGrid');
  const empty = container.querySelector('#accEmpty');

  const renderAccounts_ = (accs) => {
    if (!accs.length) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
    } else {
      grid.style.display = '';
      empty.style.display = 'none';
      grid.innerHTML = accs.map(accountCard).join('');
      bindCardEvents(grid, accs, renderAccounts_);
    }
  };

  renderAccounts_(accounts);

  // Connect button
  const openModal = () => openConnectModal(() => {
    renderAccounts_(api.USE_MOCK ? [...accounts] : accounts);
    toast('✅ Cuenta de LinkedIn conectada y lista para automatizar!', 'success', 5000);
    // Re-fetch to get the newly added account
    api.getAccounts().then(fresh => renderAccounts_(fresh));
  });

  container.querySelector('#connectNewBtn')?.addEventListener('click', openModal);
  container.querySelector('#connectEmptyBtn')?.addEventListener('click', openModal);
}

function bindCardEvents(grid, accounts, rerenderFn) {
  grid.querySelectorAll('.acc-disconnect-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const acc = accounts.find(a => a.id === id);
      if (!acc) return;
      if (!confirm(`¿Desconectás la cuenta de ${acc.name}? Se eliminarán todas las automatizaciones asociadas.`)) return;
      await api.disconnectAccount(id);
      const fresh = await api.getAccounts();
      rerenderFn(fresh);
      toast(`Cuenta de ${acc.name} desconectada`, 'info');
    });
  });

  grid.querySelectorAll('.acc-refresh-btn').forEach(btn => {
    btn.addEventListener('click', () => toast('Para renovar la cookie, reconectá la cuenta con una nueva cookie li_at válida.', 'info', 5000));
  });
}
