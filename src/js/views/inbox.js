import * as api from '../services/api.js';
import { toast } from '../ui.js';

let state = { filter: 'all', activeThreadId: null, threads: [], templates: [] };

function threadItem(t) {
  return `
    <button class="thread-item ${t.unread ? 'unread' : ''} ${state.activeThreadId === t.id ? 'active' : ''}" data-id="${t.id}">
      <div class="thread-avatar">${t.initials}</div>
      <div class="thread-body">
        <div class="thread-head">
          <div class="thread-name">${t.name}</div>
          <div class="thread-time">${t.time}</div>
        </div>
        <div class="thread-preview">${t.preview}</div>
      </div>
    </button>
  `;
}

function renderList(container) {
  const list = container.querySelector('#threadsList');
  list.innerHTML = state.threads.map(threadItem).join('');
}

function renderDetail(container) {
  const detail = container.querySelector('#inboxDetail');
  const thread = state.threads.find((t) => t.id === state.activeThreadId) || state.threads[0];
  if (!thread) {
    detail.innerHTML = '<div class="empty">Seleccioná una conversación</div>';
    return;
  }
  state.activeThreadId = thread.id;

  detail.innerHTML = `
    <div class="detail-header">
      <div class="detail-user">
        <div class="thread-avatar">${thread.initials}</div>
        <div>
          <div class="detail-name">${thread.name}</div>
          <div class="detail-title">${thread.title}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="icon-btn" title="Ver perfil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
        <button class="icon-btn" title="Añadir a lead">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      </div>
    </div>

    <div class="detail-messages" id="detailMessages">
      ${thread.messages.map((m) => `
        <div class="msg-bubble ${m.dir === 'in' ? 'incoming' : 'outgoing'}">
          ${m.text}
          <div class="msg-time">${m.time}</div>
        </div>
      `).join('')}
    </div>

    <div class="quick-templates">
      ${state.templates.map((t) => `<button class="template-chip" data-template="${t}">${t}</button>`).join('')}
    </div>

    <div class="detail-compose">
      <textarea class="compose-input" id="composeInput" placeholder="Escribí tu mensaje..." rows="1"></textarea>
      <button class="btn btn-primary" id="sendBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Enviar
      </button>
    </div>
  `;

  // Scroll to bottom
  const msgs = detail.querySelector('#detailMessages');
  msgs.scrollTop = msgs.scrollHeight;

  // Bind compose
  const input = detail.querySelector('#composeInput');
  detail.querySelector('#sendBtn').addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    await api.sendMessage(thread.id, text);
    state.threads = await api.getThreads(state.filter);
    renderDetail(document);
    toast('Mensaje enviado', 'success');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      detail.querySelector('#sendBtn').click();
    }
  });

  // Template chips
  detail.querySelectorAll('.template-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.template;
      input.focus();
    });
  });
}

export async function renderInbox(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Smart Inbox</h1>
          <p class="view-subtitle">Bandeja centralizada de tus conversaciones de LinkedIn</p>
        </div>
      </div>

      <div class="inbox-layout">
        <div class="inbox-list">
          <div class="inbox-filters" id="inboxFilters">
            <button class="filter-chip active" data-filter="all">Todos</button>
            <button class="filter-chip" data-filter="prospects">Prospectos</button>
            <button class="filter-chip" data-filter="customers">Clientes</button>
            <button class="filter-chip" data-filter="partners">Partners</button>
          </div>
          <div class="inbox-threads" id="threadsList"></div>
        </div>
        <div class="inbox-detail" id="inboxDetail"></div>
      </div>
    </div>
  `;

  state.threads = await api.getThreads();
  state.templates = await api.getQuickTemplates();
  state.activeThreadId = state.threads[0]?.id || null;

  renderList(container);
  renderDetail(container);

  // Filter clicks
  container.querySelector('#inboxFilters').addEventListener('click', async (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    container.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    state.threads = await api.getThreads(state.filter);
    state.activeThreadId = state.threads[0]?.id || null;
    renderList(container);
    renderDetail(container);
  });

  // Thread clicks
  container.querySelector('#threadsList').addEventListener('click', (e) => {
    const item = e.target.closest('.thread-item');
    if (!item) return;
    state.activeThreadId = item.dataset.id;
    renderList(container);
    renderDetail(container);
  });
}
