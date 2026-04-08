import * as api from '../services/api.js';
import { toast } from '../ui.js';

const stepIcons = {
  'Visita perfil': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  'Conexión': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>',
  'Mensaje 1': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  'Follow-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
};

function campaignCard(c) {
  return `
    <div class="card campaign-card" data-id="${c.id}">
      <div class="campaign-head">
        <div style="flex:1;">
          <div class="campaign-name">${c.name}</div>
          <div class="campaign-desc">${c.description}</div>
        </div>
        <span class="status-pill ${c.status}">${c.status === 'active' ? 'Activa' : c.status === 'paused' ? 'Pausada' : 'Borrador'}</span>
      </div>

      <div class="campaign-steps">
        ${c.steps.map((s) => `
          <div class="step-chip ${s.state}">
            ${stepIcons[s.label] || ''}
            <span>${s.label}</span>
          </div>
        `).join('')}
      </div>

      <div class="campaign-progress"><div class="campaign-progress-bar" style="width:${c.progress}%"></div></div>

      <div class="campaign-stats">
        <div class="stat-mini"><div class="stat-mini-val">${c.stats.sent}</div><div class="stat-mini-label">Enviadas</div></div>
        <div class="stat-mini"><div class="stat-mini-val">${c.stats.accepted}</div><div class="stat-mini-label">Aceptadas</div></div>
        <div class="stat-mini"><div class="stat-mini-val">${c.stats.replies}</div><div class="stat-mini-label">Respuestas</div></div>
      </div>

      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" style="flex:1;" data-action="toggle" data-id="${c.id}">
          ${c.status === 'active' ? '⏸ Pausar' : c.status === 'paused' ? '▶ Reanudar' : '🚀 Lanzar'}
        </button>
        <button class="btn btn-ghost" data-action="edit">Editar</button>
      </div>
    </div>
  `;
}

export async function renderCampaigns(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Campañas</h1>
          <p class="view-subtitle">Secuencias automatizadas de outreach B2B</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Ver métricas
          </button>
          <button class="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva campaña
          </button>
        </div>
      </div>

      <div class="campaigns-grid" id="campaignsGrid">
        <div class="empty">Cargando campañas...</div>
      </div>
    </div>
  `;

  const campaigns = await api.getCampaigns();
  const grid = container.querySelector('#campaignsGrid');
  grid.innerHTML = campaigns.map(campaignCard).join('');

  // Bind actions
  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'toggle') {
      await api.toggleCampaign(id);
      const updated = await api.getCampaigns();
      grid.innerHTML = updated.map(campaignCard).join('');
      toast('Estado de campaña actualizado', 'success');
    } else if (action === 'edit') {
      toast('Editor de campañas próximamente', 'info');
    }
  });
}
