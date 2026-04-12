import * as api from '../services/api.js';
import { toast } from '../ui.js';

const STEP_TYPES = ['Visita perfil', 'Conexión', 'Mensaje 1', 'Follow-up'];

const stepIcons = {
  'Visita perfil': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  'Conexión':      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  'Mensaje 1':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  'Follow-up':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function replyRate(c) {
  const sent = c.stats?.sent ?? c.sent ?? 0;
  if (!sent) return 0;
  return Math.round(((c.stats?.replies ?? c.replies ?? 0) / sent) * 100);
}

// Normalize campaign from API (handles both nested stats and flat fields)
function normalizeCampaign(c) {
  return {
    ...c,
    stats: c.stats || { sent: c.sent || 0, accepted: c.accepted || 0, replies: c.replies || 0 },
    steps: c.steps || [
      { label: 'Visita perfil', state: 'done' },
      { label: 'Conexión',      state: 'done' },
      { label: 'Mensaje 1',     state: 'active' },
      { label: 'Follow-up',     state: 'pending' },
    ],
    progress: c.progress || 0,
  };
}

// ── Campaign card ─────────────────────────────────────────────────────────────
function campaignCard(raw) {
  const c = normalizeCampaign(raw);
  const rate = replyRate(c);
  const rateColor = rate >= 20 ? 'var(--neon-green)' : rate >= 10 ? 'var(--neon-amber)' : 'var(--text-2)';
  const statusLabel = { active: 'Activa', paused: 'Pausada', draft: 'Borrador' }[c.status] || c.status;

  return `
    <div class="card campaign-card" data-id="${c.id}">
      <div class="campaign-head">
        <div style="flex:1;">
          <div class="campaign-name">${c.name}</div>
          <div class="campaign-desc">${c.description || 'Sin descripción'}</div>
        </div>
        <span class="status-pill ${c.status}">${statusLabel}</span>
      </div>

      <div class="campaign-steps">
        ${c.steps.map(s => `
          <div class="step-chip ${s.state}" title="${s.label}">
            ${stepIcons[s.label] || ''}
            <span>${s.label}</span>
          </div>
        `).join('')}
      </div>

      <div class="campaign-progress-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;color:var(--text-2);">Progreso</span>
          <span style="font-size:11px;font-weight:600;color:var(--text-1);">${c.progress}%</span>
        </div>
        <div class="campaign-progress"><div class="campaign-progress-bar" style="width:${c.progress}%"></div></div>
      </div>

      <div class="campaign-stats">
        <div class="stat-mini">
          <div class="stat-mini-val">${c.stats.sent}</div>
          <div class="stat-mini-label">Enviadas</div>
        </div>
        <div class="stat-mini">
          <div class="stat-mini-val">${c.stats.accepted}</div>
          <div class="stat-mini-label">Aceptadas</div>
        </div>
        <div class="stat-mini">
          <div class="stat-mini-val">${c.stats.replies}</div>
          <div class="stat-mini-label">Respuestas</div>
        </div>
        <div class="stat-mini">
          <div class="stat-mini-val" style="color:${rateColor};">${rate}%</div>
          <div class="stat-mini-label">Reply rate</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" style="flex:1;" data-action="toggle" data-id="${c.id}">
          ${c.status === 'active' ? '⏸ Pausar' : c.status === 'paused' ? '▶ Reanudar' : '🚀 Lanzar'}
        </button>
        <button class="btn btn-ghost" data-action="stats" data-id="${c.id}">📊 Métricas</button>
      </div>
    </div>`;
}

// ── Nueva campaña modal ───────────────────────────────────────────────────────
function openNewCampaignModal(onCreated) {
  const backdrop = document.createElement('div');
  backdrop.className = 'wizard-backdrop';
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));
  const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 280); };

  // Default steps selected
  const selectedSteps = new Set(['Visita perfil', 'Conexión', 'Mensaje 1']);

  const render = () => {
    backdrop.innerHTML = `
      <div class="wizard" style="max-width:560px;">
        <div class="wizard-header">
          <div class="wiz-title">Nueva campaña de outreach</div>
          <button class="icon-btn wizard-close-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="wizard-body">
          <div class="wiz-form">
            <div class="wiz-form-group">
              <label>Nombre de la campaña *</label>
              <input class="wiz-input" id="campName" placeholder="ej: Outreach HR Directors Q2 2026" value="">
            </div>
            <div class="wiz-form-group">
              <label>Descripción</label>
              <input class="wiz-input" id="campDesc" placeholder="ej: Directores de RRHH en empresas +200 empleados, Argentina">
            </div>
            <div class="wiz-form-group">
              <label>Pasos de la secuencia</label>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
                ${STEP_TYPES.map(s => `
                  <button class="wiz-var-chip step-toggle ${selectedSteps.has(s) ? 'selected' : ''}" 
                          data-step="${s}" 
                          style="${selectedSteps.has(s) ? 'background:var(--neon-blue);color:#fff;border-color:var(--neon-blue);' : ''}">
                    ${stepIcons[s] || ''} ${s}
                  </button>
                `).join('')}
              </div>
              <span class="wiz-hint">Seleccioná los pasos que tendrá la secuencia automatizada.</span>
            </div>
            <div class="connect-warning" style="margin-top:8px;">
              📋 La campaña se crea en estado <strong>Borrador</strong>. Podés lanzarla cuando esté lista.
            </div>
          </div>
        </div>
        <div class="wizard-footer">
          <div></div>
          <button class="btn btn-primary" id="createCampBtn">🚀 Crear campaña</button>
        </div>
      </div>`;

    backdrop.querySelector('.wizard-close-btn')?.addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    // Toggle steps
    backdrop.querySelectorAll('.step-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.step;
        if (selectedSteps.has(s)) {
          selectedSteps.delete(s);
          btn.classList.remove('selected');
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
        } else {
          selectedSteps.add(s);
          btn.classList.add('selected');
          btn.style.background = 'var(--neon-blue)';
          btn.style.color = '#fff';
          btn.style.borderColor = 'var(--neon-blue)';
        }
      });
    });

    backdrop.querySelector('#createCampBtn')?.addEventListener('click', async () => {
      const name = backdrop.querySelector('#campName')?.value.trim();
      const desc = backdrop.querySelector('#campDesc')?.value.trim();
      if (!name) { toast('Ingresá un nombre para la campaña', 'warning'); return; }

      const btn = backdrop.querySelector('#createCampBtn');
      btn.disabled = true;
      btn.textContent = 'Creando...';

      try {
        await api.getCampaigns(); // ensure API is warmed up
        const res = await fetch('http://localhost:8000/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: desc }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        close();
        toast(`✅ Campaña "${name}" creada en borrador`, 'success', 4000);
        onCreated();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '🚀 Crear campaña';
        toast(`Error: ${err.message}`, 'error', 5000);
      }
    });
  };

  render();
}

// ── Métricas modal ────────────────────────────────────────────────────────────
function openMetricsModal(campaigns) {
  const backdrop = document.createElement('div');
  backdrop.className = 'wizard-backdrop';
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));
  const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 280); };
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  const total = {
    sent:     campaigns.reduce((s, c) => s + (c.sent || 0), 0),
    accepted: campaigns.reduce((s, c) => s + (c.accepted || 0), 0),
    replies:  campaigns.reduce((s, c) => s + (c.replies || 0), 0),
  };
  const globalRate = total.sent ? Math.round((total.replies / total.sent) * 100) : 0;

  backdrop.innerHTML = `
    <div class="wizard" style="max-width:600px;">
      <div class="wizard-header">
        <div class="wiz-title">📊 Métricas globales de campañas</div>
        <button class="icon-btn wizard-close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="wizard-body" style="padding:24px;">
        <!-- Global summary -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
          ${[
            { label: 'Total enviadas', val: total.sent,     color: 'var(--neon-blue)'  },
            { label: 'Aceptadas',      val: total.accepted, color: 'var(--neon-green)' },
            { label: 'Respuestas',     val: total.replies,  color: 'var(--neon-purple)'},
            { label: 'Reply rate',     val: globalRate+'%', color: globalRate>=20?'var(--neon-green)':globalRate>=10?'var(--neon-amber)':'var(--neon-red)' },
          ].map(m => `
            <div class="card" style="text-align:center;padding:16px 8px;">
              <div style="font-size:26px;font-weight:800;color:${m.color};">${m.val}</div>
              <div style="font-size:11px;color:var(--text-2);margin-top:4px;">${m.label}</div>
            </div>
          `).join('')}
        </div>

        <!-- Per-campaign table -->
        <div class="card-title" style="margin-bottom:12px;">Por campaña</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${campaigns.length ? campaigns.map(c => {
            const n = normalizeCampaign(c);
            const rate = replyRate(n);
            const rateColor = rate >= 20 ? 'var(--neon-green)' : rate >= 10 ? 'var(--neon-amber)' : 'var(--text-2)';
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface-2);border-radius:8px;">
                <div style="flex:1;">
                  <div style="font-weight:600;font-size:13px;">${n.name}</div>
                  <div style="font-size:11px;color:var(--text-2);">${n.description || '–'}</div>
                </div>
                <span class="status-pill ${n.status}" style="font-size:10px;">${n.status}</span>
                <div style="text-align:right;min-width:100px;">
                  <div style="font-size:12px;color:var(--text-2);">${n.stats.sent} env · ${n.stats.replies} resp</div>
                  <div style="font-size:14px;font-weight:700;color:${rateColor};">${rate}% reply</div>
                </div>
              </div>`;
          }).join('') : '<div style="color:var(--text-2);padding:16px;text-align:center;">Sin campañas todavía. ¡Creá una!</div>'}
        </div>
      </div>
      <div class="wizard-footer">
        <div></div>
        <button class="btn btn-secondary wizard-close-btn">Cerrar</button>
      </div>
    </div>`;

  backdrop.querySelectorAll('.wizard-close-btn').forEach(b => b.addEventListener('click', close));
}

// ── Main render ───────────────────────────────────────────────────────────────
export async function renderCampaigns(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Campañas</h1>
          <p class="view-subtitle">Secuencias automatizadas de outreach B2B</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" id="metricsBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Ver métricas
          </button>
          <button class="btn btn-primary" id="newCampaignBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva campaña
          </button>
        </div>
      </div>

      <div class="campaigns-grid" id="campaignsGrid">
        ${[1,2,3].map(() => '<div class="card campaign-card skeleton" style="min-height:280px;"></div>').join('')}
      </div>
    </div>`;

  let campaigns = await api.getCampaigns();

  const renderGrid = async () => {
    campaigns = await api.getCampaigns();
    const grid = container.querySelector('#campaignsGrid');
    grid.innerHTML = campaigns.length
      ? campaigns.map(campaignCard).join('')
      : `<div class="empty" style="grid-column:1/-1;padding:48px;text-align:center;">
           <div style="font-size:48px;margin-bottom:16px;">📋</div>
           <h3>Sin campañas todavía</h3>
           <p style="color:var(--text-2);margin:8px 0 20px;">Creá tu primera campaña de outreach B2B</p>
           <button class="btn btn-primary" id="emptyNewBtn">+ Nueva campaña</button>
         </div>`;

    bindGridEvents(grid, campaigns, renderGrid);
    container.querySelector('#emptyNewBtn')?.addEventListener('click', () =>
      openNewCampaignModal(renderGrid));
  };

  await renderGrid();

  container.querySelector('#newCampaignBtn')?.addEventListener('click', () =>
    openNewCampaignModal(renderGrid));

  container.querySelector('#metricsBtn')?.addEventListener('click', () =>
    openMetricsModal(campaigns));
}

function bindGridEvents(grid, campaigns, rerenderFn) {
  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const c = campaigns.find(x => x.id === id);

    if (action === 'toggle') {
      btn.disabled = true;
      btn.textContent = '...';
      await api.toggleCampaign(id);
      await rerenderFn();
      toast('Estado actualizado', 'success');
    } else if (action === 'stats') {
      openMetricsModal(c ? [c] : campaigns);
    }
  });
}
