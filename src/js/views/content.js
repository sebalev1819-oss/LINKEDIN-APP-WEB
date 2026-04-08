import * as api from '../services/api.js';
import { toast } from '../ui.js';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function calendarCell(d) {
  const cls = ['cal-day'];
  if (d.out) cls.push('out');
  if (d.today) cls.push('today');
  const dot = d.scheduled ? `<span class="cal-dot ${d.scheduled}"></span>` : '';
  return `<div class="${cls.join(' ')}">${d.n}${dot}</div>`;
}

function postItem(p) {
  return `
    <div class="post-item">
      <div class="post-date">📅 ${p.date}</div>
      <div class="post-text">${p.text}</div>
      <div class="post-foot">
        <span class="post-type">${p.type}</span>
        <div class="post-actions">
          <button title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button title="Duplicar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
          <button title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg></button>
        </div>
      </div>
    </div>
  `;
}

export async function renderContent(container) {
  container.innerHTML = `
    <div class="view">
      <div class="view-header">
        <div>
          <h1 class="view-title">Calendario de contenido</h1>
          <p class="view-subtitle">Programá tus posts founder para HR & CEOs en LATAM</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Borradores
          </button>
          <button class="btn btn-primary" id="newPostBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo post
          </button>
        </div>
      </div>

      <div class="content-layout">
        <div class="calendar">
          <div class="calendar-head">
            <div>
              <div class="calendar-title">Abril 2026</div>
              <div class="card-subtitle">5 posts programados</div>
            </div>
            <div class="calendar-nav">
              <button class="cal-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
              <button class="cal-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
          </div>
          <div class="calendar-grid" id="calendarGrid">
            ${dayLabels.map((d) => `<div class="cal-day-label">${d}</div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-title">Próximos posts</div>
          <div class="card-subtitle">En los próximos 14 días</div>
          <div class="posts-list" id="postsList"></div>
        </div>
      </div>
    </div>
  `;

  const [days, posts] = await Promise.all([api.getCalendarDays(), api.getScheduledPosts()]);

  const grid = container.querySelector('#calendarGrid');
  grid.insertAdjacentHTML('beforeend', days.map(calendarCell).join(''));

  container.querySelector('#postsList').innerHTML = posts.map(postItem).join('');

  container.querySelector('#newPostBtn').addEventListener('click', () => {
    toast('Editor de posts próximamente ✨', 'info');
  });
}
