/**
 * src/js/views/content.js
 * LinkedIn Manager — Contenido + Compositor de posts + Cola de publicación
 */
import * as api from '../services/api.js';
import { toast } from '../ui.js';

const POST_TYPES = ['Thought leadership', 'Caso de éxito', 'Storytelling', 'Insight de datos', 'Engagement'];
const MAX_CHARS   = 3000;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  scheduled: { label: '🕐 Programado', cls: 'status-scheduled' },
  published:  { label: '✅ Publicado',  cls: 'status-published' },
  draft:      { label: '📝 Borrador',   cls: 'status-draft'     },
  error:      { label: '❌ Error',      cls: 'status-error'      },
};

// ── Post queue card ───────────────────────────────────────────────────────────
function queueCard(p) {
  const s   = STATUS_CFG[p.status] || STATUS_CFG.draft;
  const preview = p.text.length > 160 ? p.text.slice(0, 157) + '…' : p.text;

  return `
    <div class="pq-card" data-id="${p.id}" data-status="${p.status}">
      <div class="pq-card-head">
        <div class="pq-type-badge">${p.type}</div>
        <span class="pq-status ${s.cls}">${s.label}</span>
      </div>
      <div class="pq-text">${preview.replace(/\n/g, ' ')}</div>
      ${p.hashtags?.length ? `<div class="pq-hashtags">${p.hashtags.map(h => `<span class="pq-ht">${h}</span>`).join('')}</div>` : ''}
      <div class="pq-meta">
        <div class="pq-account">
          <div class="pq-avatar">${p.accountName?.substring(0, 2).toUpperCase() || 'SL'}</div>
          <span>${p.accountName}</span>
        </div>
        ${p.status === 'scheduled' ? `<span class="pq-date">📅 ${p.scheduledAt}</span>` : ''}
        ${p.status === 'published' ?
          `<div class="pq-metrics">
            <span>❤️ ${p.metrics?.likes ?? 0}</span>
            <span>💬 ${p.metrics?.comments ?? 0}</span>
            <span>👁️ ${p.metrics?.views ?? 0}</span>
            <span>🔁 ${p.metrics?.reposts ?? 0}</span>
          </div>` : ''}
      </div>
      <div class="pq-actions">
        ${p.status !== 'published' ? `<button class="btn btn-ghost pq-edit-btn" data-id="${p.id}" style="font-size:12px;">✏️ Editar</button>` : ''}
        <button class="btn btn-ghost pq-delete-btn" data-id="${p.id}" style="font-size:12px;color:var(--neon-red);">🗑️ Eliminar</button>
        ${p.status === 'scheduled' ? `<button class="btn btn-secondary pq-publish-now" data-id="${p.id}" style="font-size:12px;">▶ Publicar ahora</button>` : ''}
      </div>
    </div>`;
}

// ── LinkedIn post preview ─────────────────────────────────────────────────────
function linkedinPreview(text, accountName) {
  const formatted = text
    .replace(/\n/g, '<br>')
    .replace(/(#\w+)/g, '<span style="color:#0a66c2;">$1</span>');
  return `
    <div class="ln-preview">
      <div class="ln-preview-head">
        <div class="ln-preview-avatar">${(accountName || 'SL').slice(0, 2).toUpperCase()}</div>
        <div>
          <div class="ln-preview-name">${accountName || 'Tu nombre'}</div>
          <div class="ln-preview-subline">Founder @ Care Assistance · 1er</div>
          <div class="ln-preview-time">Ahora · 🌍</div>
        </div>
      </div>
      <div class="ln-preview-text">${formatted || '<span style="opacity:0.4;">Tu post aparecerá aquí...</span>'}</div>
      <div class="ln-preview-reactions">
        <span>👍 Me gusta</span>
        <span>💬 Comentar</span>
        <span>🔁 Repostear</span>
        <span>✈️ Enviar</span>
      </div>
    </div>`;
}

// ── Composer modal ────────────────────────────────────────────────────────────
function openComposer({ accounts, allHashtags, onSaved, editPost = null }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'wizard-backdrop';
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));
  const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 280); };

  const defaultText = editPost?.text || '';
  const defaultType = editPost?.type || POST_TYPES[0];
  const accId       = editPost?.accountId || accounts[0]?.id || '';

  backdrop.innerHTML = `
    <div class="wizard composer-wizard">
      <div class="wizard-header">
        <div class="wiz-title">${editPost ? 'Editar publicación' : 'Nueva publicación'}</div>
        <button class="icon-btn wizard-close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="wizard-body composer-body">
        <!-- Left: editor -->
        <div class="composer-editor">
          <div class="comp-row">
            <div class="wiz-form-group" style="flex:1;">
              <label>Cuenta</label>
              <select class="wiz-input" id="compAccount">
                ${accounts.map(a => `<option value="${a.id}" ${a.id === accId ? 'selected' : ''}>${a.name}</option>`).join('')}
                ${!accounts.length ? '<option>Sin cuentas conectadas</option>' : ''}
              </select>
            </div>
            <div class="wiz-form-group" style="flex:1;">
              <label>Tipo</label>
              <select class="wiz-input" id="compType">
                ${POST_TYPES.map(t => `<option value="${t}" ${t === defaultType ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="wiz-form-group">
            <label>Contenido del post <span class="comp-chars" id="compCharsLeft">${MAX_CHARS - defaultText.length} / ${MAX_CHARS}</span></label>
            <textarea class="wiz-input wiz-textarea comp-textarea" id="compText" placeholder="Escribí tu post aquí... Usá {{nombre}}, {{empresa}} para personalizar.">${defaultText}</textarea>
          </div>

          <div class="wiz-form-group">
            <label>Hashtags sugeridos (click para agregar)</label>
            <div class="wiz-vars" id="hashtagSuggestions">
              ${(allHashtags[defaultType] || []).map(h => `<button class="wiz-var-chip comp-ht-chip" data-tag="${h}">${h}</button>`).join('')}
            </div>
          </div>

          <div class="comp-row">
            <div class="wiz-form-group" style="flex:1;">
              <label>📅 Fecha y hora de publicación</label>
              <input type="datetime-local" class="wiz-input" id="compSchedule">
            </div>
          </div>
        </div>

        <!-- Right: LinkedIn preview -->
        <div class="composer-preview" id="compPreview">
          ${linkedinPreview(defaultText, accounts[0]?.name || '')}
        </div>
      </div>

      <div class="wizard-footer">
        <button class="btn btn-secondary" id="compDraft">💾 Guardar borrador</button>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" id="compScheduleBtn" ${!accounts.length ? 'disabled' : ''}>📅 Programar</button>
          <button class="btn btn-primary" id="compPublishNow" ${!accounts.length ? 'disabled' : ''}>▶ Publicar ahora</button>
        </div>
      </div>
    </div>`;

  // Bind events
  backdrop.querySelector('.wizard-close-btn')?.addEventListener('click', close);

  const textarea    = backdrop.querySelector('#compText');
  const charsLeft   = backdrop.querySelector('#compCharsLeft');
  const previewEl   = backdrop.querySelector('#compPreview');
  const typeSelect  = backdrop.querySelector('#compType');
  const accSelect   = backdrop.querySelector('#compAccount');
  const hashtagsEl  = backdrop.querySelector('#hashtagSuggestions');

  const updatePreview = () => {
    const acc = accounts.find(a => a.id === accSelect?.value);
    previewEl.innerHTML = linkedinPreview(textarea.value, acc?.name || '');
    const len = textarea.value.length;
    charsLeft.textContent = `${MAX_CHARS - len} / ${MAX_CHARS}`;
    charsLeft.style.color = len > MAX_CHARS * 0.9 ? 'var(--neon-red)' : len > MAX_CHARS * 0.7 ? 'var(--neon-amber)' : 'var(--text-3)';
  };

  const updateHashtags = () => {
    const tags = allHashtags[typeSelect.value] || [];
    hashtagsEl.innerHTML = tags.map(h => `<button class="wiz-var-chip comp-ht-chip" data-tag="${h}">${h}</button>`).join('');
    bindHashtags();
  };

  const bindHashtags = () => {
    backdrop.querySelectorAll('.comp-ht-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        if (!textarea.value.includes(tag)) {
          textarea.value += (textarea.value.endsWith('\n') || !textarea.value ? '' : '\n') + tag;
          updatePreview();
        }
      });
    });
  };

  textarea.addEventListener('input', updatePreview);
  typeSelect.addEventListener('change', updateHashtags);
  accSelect.addEventListener('change', updatePreview);
  bindHashtags();

  const getPostData = (publishNow = false) => ({
    accountId:  accSelect?.value,
    type:       typeSelect?.value,
    text:       textarea.value,
    hashtags:   (textarea.value.match(/#\w+/g) || []),
    scheduledAt: backdrop.querySelector('#compSchedule')?.value || null,
    publishNow,
  });

  backdrop.querySelector('#compDraft')?.addEventListener('click', async () => {
    if (!textarea.value.trim()) { toast('Escribí algo primero', 'warning'); return; }
    await api.schedulePost({ ...getPostData(), scheduledAt: null, publishNow: false });
    close(); toast('Borrador guardado 💾', 'info'); onSaved();
  });

  backdrop.querySelector('#compScheduleBtn')?.addEventListener('click', async () => {
    const sched = backdrop.querySelector('#compSchedule')?.value;
    if (!textarea.value.trim()) { toast('Escribí el contenido del post', 'warning'); return; }
    if (!sched) { toast('Seleccioná fecha y hora de publicación', 'warning'); return; }
    const dateStr = new Date(sched).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    await api.schedulePost(getPostData(false));
    close(); toast(`📅 Post programado para ${dateStr}`, 'success', 5000); onSaved();
  });

  backdrop.querySelector('#compPublishNow')?.addEventListener('click', async () => {
    if (!textarea.value.trim()) { toast('Escribí el contenido del post', 'warning'); return; }
    const btn = backdrop.querySelector('#compPublishNow');
    btn.disabled = true; btn.textContent = '⏳ Publicando...';
    await api.schedulePost(getPostData(true));
    close(); toast('🚀 Post publicado en LinkedIn!', 'success', 5000); onSaved();
  });
}

// ── Calendar (existing) ───────────────────────────────────────────────────────
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function renderCalendar(days) {
  return `
    <div class="cal-grid-header">
      ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}
    </div>
    <div class="cal-grid">
      ${days.map(d => `
        <div class="cal-day ${d.today ? 'today' : ''} ${d.out ? 'out' : ''}">
          <span>${d.n}</span>
          ${d.scheduled ? `<div class="cal-dot ${d.scheduled}"></div>` : ''}
        </div>`).join('')}
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────
export async function renderContent(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Contenido</h1>
          <p class="view-subtitle">Compositor y cola de publicaciones en LinkedIn</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="newPostBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo post
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="content-tabs" id="contentTabs">
        <button class="content-tab active" data-tab="queue">📋 Cola de publicación</button>
        <button class="content-tab" data-tab="calendar">📅 Calendario</button>
      </div>

      <!-- Queue tab -->
      <div id="tabQueue">
        <div class="pq-filter-row">
          <button class="pq-filter active" data-filter="all">Todos</button>
          <button class="pq-filter" data-filter="scheduled">🕐 Programados</button>
          <button class="pq-filter" data-filter="published">✅ Publicados</button>
          <button class="pq-filter" data-filter="draft">📝 Borradores</button>
        </div>
        <div class="pq-grid" id="pqGrid">
          ${[1,2,3].map(() => '<div class="pq-card skeleton" style="height:200px;"></div>').join('')}
        </div>
      </div>

      <!-- Calendar tab -->
      <div id="tabCalendar" style="display:none;">
        <div class="content-layout">
          <div class="card calendar-card" id="calCard">
            <div class="card-title">Abril 2026</div>
            <div id="calGrid" style="margin-top:12px;">
              <div class="skeleton" style="height:280px;border-radius:8px;"></div>
            </div>
          </div>
          <div class="card" id="scheduledList">
            <div class="card-title">Posts programados</div>
            <div class="card-subtitle" style="margin-bottom:14px;">Próximas publicaciones</div>
            <div id="scheduledItems">
              ${[1,2,3].map(() => '<div class="skeleton" style="height:80px;border-radius:8px;margin-bottom:10px;"></div>').join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Fetch all data
  const [queue, days, accounts, allHashtags] = await Promise.all([
    api.getPostQueue(),
    api.getCalendarDays(),
    api.getAccounts(),
    api.getSuggestedHashtags(),
  ]);

  // ── Post Queue ──
  let currentFilter = 'all';

  const renderQueue = () => {
    const filtered = currentFilter === 'all' ? queue : queue.filter(p => p.status === currentFilter);
    const grid = container.querySelector('#pqGrid');
    grid.innerHTML = filtered.length
      ? filtered.map(queueCard).join('')
      : `<div class="empty">No hay posts en esta categoría. ¡Creá uno nuevo!</div>`;
    bindQueueEvents(grid, queue, renderQueue, accounts, allHashtags);
  };

  renderQueue();

  container.querySelector('.pq-filter-row')?.addEventListener('click', e => {
    const btn = e.target.closest('.pq-filter');
    if (!btn) return;
    container.querySelectorAll('.pq-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderQueue();
  });

  // ── Calendar ──
  container.querySelector('#calGrid').innerHTML = renderCalendar(days);
  container.querySelector('#scheduledItems').innerHTML = queue
    .filter(p => p.status === 'scheduled')
    .map(p => `
      <div class="post-card" style="cursor:default;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span class="post-type">${p.type}</span>
          <span class="pq-date" style="font-size:11px;color:var(--text-3);">📅 ${p.scheduledAt}</span>
        </div>
        <div class="post-preview">${p.text.slice(0, 100)}…</div>
      </div>`)
    .join('') || '<div class="empty" style="padding:20px;">Sin posts programados</div>';

  // ── Tab switching ──
  container.querySelector('#contentTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.content-tab');
    if (!btn) return;
    container.querySelectorAll('.content-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    container.querySelector('#tabQueue').style.display    = tab === 'queue'    ? '' : 'none';
    container.querySelector('#tabCalendar').style.display = tab === 'calendar' ? '' : 'none';
  });

  // ── New post button ──
  container.querySelector('#newPostBtn')?.addEventListener('click', () => {
    openComposer({ accounts, allHashtags, onSaved: renderQueue });
  });

}

function bindQueueEvents(grid, queue, rerender, accounts, allHashtags) {
  grid.querySelectorAll('.pq-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const post = queue.find(p => p.id === id);
      if (!confirm('¿Eliminar este post?')) return;
      await api.deletePost(id);
      const idx = queue.findIndex(p => p.id === id);
      if (idx >= 0) queue.splice(idx, 1);
      rerender();
      toast('Post eliminado', 'info');
    });
  });

  grid.querySelectorAll('.pq-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const post  = queue.find(p => p.id === id);
      if (!post)  return;
      openComposer({ accounts, allHashtags, onSaved: rerender, editPost: post });
    });
  });

  grid.querySelectorAll('.pq-publish-now').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = btn.dataset.id;
      const post = queue.find(p => p.id === id);
      if (!post) return;
      btn.disabled = true; btn.textContent = '⏳ Publicando...';
      post.status = 'published';
      post.publishedAt = 'Ahora';
      post.metrics = { likes: 0, comments: 0, views: 0, reposts: 0 };
      await new Promise(r => setTimeout(r, 800));
      rerender();
      toast('🚀 Post publicado en LinkedIn!', 'success', 5000);
    });
  });
}
