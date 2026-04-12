import * as api from '../services/api.js';
import { toast } from '../ui.js';

const columns = [
  { key: 'new', title: 'Nuevos', cls: 'col-new' },
  { key: 'contacted', title: 'Contactados', cls: 'col-contacted' },
  { key: 'engaged', title: 'Interesados', cls: 'col-engaged' },
  { key: 'won', title: 'Cerrados 🏆', cls: 'col-won' },
];

const tagLabels = { hr: 'HR', ceo: 'CEO', latam: 'LATAM', wellness: 'Wellness' };

function scoreBar(score) {
  const color = score >= 85 ? 'var(--neon-green)' : score >= 70 ? 'var(--neon-amber)' : 'var(--neon-pink)';
  return `
    <div class="lead-score-bar" title="Score: ${score}">
      <div class="lead-score-fill" style="width:${score}%;background:${color};"></div>
    </div>
  `;
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
        ${lead.tags.map((t) => `<span class="tag ${t}">${tagLabels[t] || t}</span>`).join('')}
      </div>
      ${scoreBar(lead.score)}
      <div class="lead-foot">
        <span style="display:flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${lead.time}
        </span>
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
        ${items.length ? items.map(leadCard).join('') : `<div class="kanban-empty">Arrastrá leads aquí</div>`}
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
          <button class="btn btn-secondary" id="filterBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtros
          </button>
          <button class="btn btn-primary" id="addLeadBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir lead
          </button>
        </div>
      </div>

      <div class="kanban" id="kanban">
        ${columns.map((c) => `<div class="kanban-col ${c.cls} skeleton" style="min-height:400px;"></div>`).join('')}
      </div>
    </div>
  `;

  const leads = await api.getLeads();
  const kanban = container.querySelector('#kanban');
  kanban.innerHTML = columns.map((c) => kanbanColumn(c, leads)).join('');

  container.querySelector('#addLeadBtn')?.addEventListener('click', () => {
    toast('Formulario de leads próximamente ✨', 'info');
  });
  container.querySelector('#filterBtn')?.addEventListener('click', () => {
    toast('Panel de filtros próximamente 🔍', 'info');
  });

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  let draggingId = null;
  let sourceCol = null;
  let dragEl = null;

  kanban.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.lead-card');
    if (!card) return;
    draggingId = card.dataset.id;
    sourceCol = card.closest('.kanban-col').dataset.col;
    dragEl = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Allow browser to render before applying opacity
    setTimeout(() => { if (card) card.style.opacity = '0.35'; }, 0);
  });

  kanban.addEventListener('dragend', () => {
    dragEl?.classList.remove('dragging');
    if (dragEl) dragEl.style.opacity = '';
    dragEl = null;
    kanban.querySelectorAll('.kanban-col').forEach((col) => col.classList.remove('drag-over'));
  });

  kanban.addEventListener('dragover', (e) => {
    const col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    kanban.querySelectorAll('.kanban-col').forEach((c) => c.classList.remove('drag-over'));
    col.classList.add('drag-over');
  });

  kanban.addEventListener('dragleave', (e) => {
    const col = e.target.closest('.kanban-col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });

  kanban.addEventListener('drop', async (e) => {
    const col = e.target.closest('.kanban-col');
    if (!col || !draggingId) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    const targetCol = col.dataset.col;
    if (targetCol === sourceCol) return;

    await api.moveLead(draggingId, sourceCol, targetCol);
    const updated = await api.getLeads();
    kanban.innerHTML = columns.map((c) => kanbanColumn(c, updated)).join('');
    const colName = columns.find((c) => c.key === targetCol)?.title || targetCol;
    toast(`Lead movido a "${colName}" 🎯`, 'success');
    draggingId = null;
    sourceCol = null;
  });
}
