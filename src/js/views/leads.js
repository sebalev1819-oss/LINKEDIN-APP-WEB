import * as api from '../services/api.js';
import { toast } from '../ui.js';

const columns = [
  { key: 'new', title: 'Nuevos', cls: 'col-new' },
  { key: 'contacted', title: 'Contactados', cls: 'col-contacted' },
  { key: 'engaged', title: 'Interesados', cls: 'col-engaged' },
  { key: 'won', title: 'Cerrados', cls: 'col-won' },
];

function tagLabel(tag) {
  const map = { hr: 'HR', ceo: 'CEO', latam: 'LATAM', wellness: 'Wellness' };
  return map[tag] || tag;
}

function leadCard(lead) {
  return `
    <div class="lead-card" draggable="true" data-id="${lead.id}">
      <div class="lead-head">
        <div class="lead-avatar">${lead.initials}</div>
        <div style="flex:1;min-width:0;">
          <div class="lead-name">${lead.name}</div>
          <div class="lead-company">${lead.company}</div>
        </div>
      </div>
      <div class="lead-tags">
        ${lead.tags.map((t) => `<span class="tag ${t}">${tagLabel(t)}</span>`).join('')}
      </div>
      <div class="lead-foot">
        <span>${lead.time}</span>
        <span class="lead-score">
          <span class="heat">★</span>
          <span>${lead.score}</span>
        </span>
      </div>
    </div>
  `;
}

function kanbanColumn(col, leads) {
  const items = leads[col.key] || [];
  return `
    <div class="kanban-col ${col.cls}" data-col="${col.key}">
      <div class="kanban-col-header">
        <div class="col-title"><span class="dot"></span>${col.title}</div>
        <div class="col-count">${items.length}</div>
      </div>
      <div class="kanban-cards" data-col-body="${col.key}">
        ${items.map(leadCard).join('')}
      </div>
    </div>
  `;
}

export async function renderLeads(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Leads CRM</h1>
          <p class="view-subtitle">Pipeline visual de prospectos B2B · Arrastrá para mover</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Filtros
          </button>
          <button class="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir lead
          </button>
        </div>
      </div>

      <div class="kanban" id="kanban">
        <div class="empty">Cargando leads...</div>
      </div>
    </div>
  `;

  const leads = await api.getLeads();
  const kanban = container.querySelector('#kanban');
  kanban.innerHTML = columns.map((c) => kanbanColumn(c, leads)).join('');

  // Drag & drop
  let draggingId = null;
  let sourceCol = null;

  kanban.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.lead-card');
    if (!card) return;
    draggingId = card.dataset.id;
    sourceCol = card.closest('.kanban-col').dataset.col;
    card.style.opacity = '0.4';
  });

  kanban.addEventListener('dragend', (e) => {
    const card = e.target.closest('.lead-card');
    if (card) card.style.opacity = '';
  });

  kanban.addEventListener('dragover', (e) => {
    const col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault();
    col.style.background = 'rgba(79,140,255,0.08)';
  });

  kanban.addEventListener('dragleave', (e) => {
    const col = e.target.closest('.kanban-col');
    if (col) col.style.background = '';
  });

  kanban.addEventListener('drop', async (e) => {
    const col = e.target.closest('.kanban-col');
    if (!col || !draggingId) return;
    e.preventDefault();
    col.style.background = '';
    const targetCol = col.dataset.col;
    if (targetCol === sourceCol) return;

    await api.moveLead(draggingId, sourceCol, targetCol);
    const updated = await api.getLeads();
    kanban.innerHTML = columns.map((c) => kanbanColumn(c, updated)).join('');
    toast(`Lead movido a ${columns.find((c) => c.key === targetCol).title}`, 'success');
    draggingId = null;
    sourceCol = null;
  });
}
