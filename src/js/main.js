// Main entry — router + app bootstrap
import { renderDashboard } from './views/dashboard.js';
import { renderCampaigns } from './views/campaigns.js';
import { renderInbox } from './views/inbox.js';
import { renderLeads } from './views/leads.js';
import { renderContent } from './views/content.js';
import { toast } from './ui.js';

const views = {
  dashboard: renderDashboard,
  campaigns: renderCampaigns,
  inbox: renderInbox,
  leads: renderLeads,
  content: renderContent,
};

const container = document.getElementById('viewContainer');
const navItems = document.querySelectorAll('.nav-item');

async function navigate(viewName) {
  const view = views[viewName];
  if (!view) return;

  // Update nav state
  navItems.forEach((n) => n.classList.toggle('active', n.dataset.view === viewName));

  // Close mobile sidebar after navigation
  document.getElementById('sidebar').classList.remove('open');

  // Render
  try {
    await view(container);
    // Update URL hash (no reload)
    history.replaceState(null, '', `#${viewName}`);
  } catch (err) {
    console.error('Error rendering view', err);
    container.innerHTML = '<div class="empty">Error al cargar la vista</div>';
  }
}

// Nav click handlers
navItems.forEach((n) => {
  n.addEventListener('click', () => navigate(n.dataset.view));
});

// Mobile menu toggle
document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// New campaign shortcut
document.getElementById('newCampaignBtn')?.addEventListener('click', () => {
  navigate('campaigns');
  setTimeout(() => toast('Click en "Nueva campaña" para abrir el editor', 'info'), 400);
});

// Keyboard shortcut: ⌘K / Ctrl+K for search
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.querySelector('.search-box input')?.focus();
  }
});

// Initial view from hash or default
const initial = location.hash.slice(1) || 'dashboard';
navigate(views[initial] ? initial : 'dashboard');

// Welcome toast
setTimeout(() => toast('Bienvenido de vuelta, Sebastián 👋', 'success', 3500), 600);
