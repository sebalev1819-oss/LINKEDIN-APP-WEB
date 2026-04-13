// Shared UI helpers

/**
 * Escape HTML entities to prevent XSS when inserting user/API data into innerHTML.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** Standardized toast durations by type */
const TOAST_DURATION = { success: 3000, info: 3000, warning: 4000, error: 5000 };

const icons = {
  success: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4f8cff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  error: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

function dismissToast(el) {
  if (el._dismissed) return;
  el._dismissed = true;
  el.style.transition = 'opacity 200ms, transform 200ms';
  el.style.opacity = '0';
  el.style.transform = 'translateX(30px)';
  setTimeout(() => el.remove(), 220);
}

export function toast(message, type = 'info', duration) {
  duration = duration ?? TOAST_DURATION[type] ?? 3000;
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type] || icons.info}<span>${message}</span><button class="toast-close" aria-label="Cerrar">✕</button>`;
  container.appendChild(el);

  el.querySelector('.toast-close').addEventListener('click', () => dismissToast(el));
  el.addEventListener('click', () => dismissToast(el));

  const timer = setTimeout(() => dismissToast(el), duration);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => setTimeout(() => dismissToast(el), 800));
}

/**
 * Show a modal dialog.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body  — HTML string
 * @param {Array<{label:string, cls:string, onClick:function}>} opts.actions
 * @returns {function} close — call to close programmatically
 */
export function modal({ title, body, actions = [] }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="icon-btn modal-close-btn" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">${body}</div>
      ${actions.length ? `<div class="modal-footer">${actions.map((a, i) => `<button class="btn ${a.cls || 'btn-secondary'}" data-action-idx="${i}">${a.label}</button>`).join('')}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);
  // Animate in
  requestAnimationFrame(() => backdrop.classList.add('open'));

  const close = () => {
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 280);
  };

  backdrop.querySelector('.modal-close-btn').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  actions.forEach((a, i) => {
    backdrop.querySelector(`[data-action-idx="${i}"]`).addEventListener('click', () => {
      a.onClick?.({ close });
    });
  });

  // Trap focus
  const focusable = backdrop.querySelectorAll('button, input, textarea, select, [tabindex]');
  focusable[0]?.focus();

  return close;
}

/**
 * Animate a numeric counter from 0 to target value.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {number} duration ms
 */
export function animateCount(el, target, duration = 800) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(target * eased).toLocaleString('es-AR');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
