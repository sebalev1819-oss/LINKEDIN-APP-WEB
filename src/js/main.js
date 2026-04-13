// Main entry — router + app bootstrap
import { renderDashboard } from './views/dashboard.js';
import { renderCampaigns } from './views/campaigns.js';
import { renderInbox } from './views/inbox.js';
import { renderLeads } from './views/leads.js';
import { renderContent } from './views/content.js';
import { renderAutomations } from './views/automations.js';
import { renderAccounts } from './views/accounts.js';
import { toast } from './ui.js';

const views = {
  dashboard:    renderDashboard,
  campaigns:    renderCampaigns,
  inbox:        renderInbox,
  leads:        renderLeads,
  content:      renderContent,
  automations:  renderAutomations,
  accounts:     renderAccounts,
};

const container = document.getElementById('viewContainer');
const navItems = document.querySelectorAll('.nav-item');
const sidebar = document.getElementById('sidebar');

// ── Mobile overlay ────────────────────────────────────────────────────────────
let overlay = document.getElementById('sidebarOverlay');
if (!overlay) {
  overlay = document.createElement('div');
  overlay.id = 'sidebarOverlay';
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
}
overlay.addEventListener('click', closeSidebar);

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

// ── Loading indicator ─────────────────────────────────────────────────────────
let loadingEl = null;

function showLoading() {
  if (loadingEl) return;
  loadingEl = document.createElement('div');
  loadingEl.className = 'view-loading';
  loadingEl.innerHTML = `
    <div class="spinner"></div>
    <span>Cargando...</span>
  `;
  container.innerHTML = '';
  container.appendChild(loadingEl);
}

function hideLoading() {
  loadingEl?.remove();
  loadingEl = null;
}

// ── Router ────────────────────────────────────────────────────────────────────
let currentView = null;
let isNavigating = false;

async function navigate(viewName) {
  if (viewName === currentView || isNavigating) return;
  const view = views[viewName];
  if (!view) return;

  isNavigating = true;
  currentView = viewName;

  // Update nav state
  navItems.forEach((n) => n.classList.toggle('active', n.dataset.view === viewName));

  // Close mobile sidebar after navigation
  closeSidebar();

  // Show loading state
  showLoading();

  // Render
  try {
    await view(container);
    history.replaceState(null, '', `#${viewName}`);
  } catch (err) {
    console.error('Error rendering view:', err);
    container.innerHTML = `
      <div class="view-error">
        <div class="error-icon">⚠️</div>
        <h2>Error al cargar la vista</h2>
        <p>${err.message || 'Algo salió mal. Intentá de nuevo.'}</p>
        <button class="btn btn-primary" id="retryBtn">Reintentar</button>
      </div>
    `;
    container.querySelector('#retryBtn')?.addEventListener('click', () => {
      currentView = null;
      navigate(viewName);
    });
  } finally {
    hideLoading();
    isNavigating = false;
  }
}

// ── Event bindings ────────────────────────────────────────────────────────────
navItems.forEach((n) => {
  n.addEventListener('click', () => navigate(n.dataset.view));
});

document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});

document.getElementById('newCampaignBtn')?.addEventListener('click', () => {
  navigate('campaigns');
  setTimeout(() => toast('Hacé click en "Nueva campaña" para abrir el editor', 'info'), 400);
});

// Keyboard shortcut: ⌘K / Ctrl+K for search
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.querySelector('.search-box input')?.focus();
  }
  // Esc to close sidebar on mobile
  if (e.key === 'Escape') closeSidebar();
});

// ── Initial render ────────────────────────────────────────────────────────────
const initial = location.hash.slice(1) || 'dashboard';
navigate(views[initial] ? initial : 'dashboard');

// Welcome toast — uses first connected account name or generic
import { getAccounts } from './services/api.js';
getAccounts().then(accs => {
  const name = accs?.[0]?.name?.split(' ')[0] || 'Usuario';
  toast(`Bienvenido de vuelta, ${name}`, 'success');
}).catch(() => toast('Bienvenido de vuelta', 'success'));

// ── Backend status indicator with exponential backoff ─────────────────────────
const statusEl   = document.getElementById('backendStatus');
const statusDot  = statusEl?.querySelector('.backend-dot');
const statusLbl  = statusEl?.querySelector('.backend-label');

let healthFailures = 0;
let healthInterval = 30_000;
let healthTimer = null;
let wasLive = null; // track transitions

async function checkBackendStatus() {
  try {
    const r = await fetch('http://localhost:8000/api/health', {
      signal: AbortSignal.timeout(2000),
    });
    if (r.ok) {
      // Went from offline → online
      if (wasLive === false) {
        toast('Backend reconectado', 'success');
      }
      wasLive = true;
      healthFailures = 0;
      healthInterval = 30_000;
      statusEl?.classList.add('live');
      statusEl?.classList.remove('mock');
      if (statusDot)  statusDot.style.background = 'var(--neon-green)';
      if (statusLbl)  statusLbl.textContent = 'Backend ON';
    } else throw new Error('not ok');
  } catch {
    // Went from online → offline
    if (wasLive !== false) {
      toast('Modo demo — backend no disponible', 'warning');
    }
    wasLive = false;
    healthFailures++;
    statusEl?.classList.add('mock');
    statusEl?.classList.remove('live');
    if (statusDot)  statusDot.style.background = 'var(--neon-amber)';
    if (statusLbl)  statusLbl.textContent = 'Modo demo';

    // Exponential backoff: 30s → 60s → 120s (max)
    if (healthFailures >= 3) {
      healthInterval = Math.min(healthInterval * 2, 120_000);
    }
  }

  // Schedule next check
  clearTimeout(healthTimer);
  healthTimer = setTimeout(checkBackendStatus, healthInterval);
}

checkBackendStatus();
