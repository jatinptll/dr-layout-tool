/* ============================================================
   App Module — SPA Router & Application Shell
   Hash-based routing, navigation, page transitions
   ============================================================ */

import { login, logout, getCurrentUser, initAuth, isAuthenticated } from './auth.js';
import { initData, subscribeToHouseChanges } from './data.js';
import { getSupabaseConfigError, isSupabaseConfigured } from './supabase.js';
import { renderDashboard } from './dashboard.js';
import { createMap } from './map-renderer.js';
import { ANTONIA_CONFIG, ANTONIA_HOUSES } from './antonia-map.js';
import { ARANYA_CONFIG, ARANYA_HOUSES } from './aranya-map.js';
import { showHousePopup, closePopup } from './popup.js';
import { renderAdmin } from './admin.js';
import { startPresence, stopPresence } from './presence.js';
import { renderSuperAdmin } from './super-admin.js';

// ── Init ───────────────────────────────────────────────────
const app = document.getElementById('app');
let currentMapInstance = null;
let routeCleanup = null;
let dataUnsubscribe = null;
let dataReady = false;

function hasAdminAccess(user) {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// ── Router ─────────────────────────────────────────────────
function getRoute() {
  return window.location.hash.slice(1) || '/login';
}

function navigate(route) {
  window.location.hash = route;
}

async function ensureDataReady() {
  if (!isAuthenticated() || dataReady) return true;

  try {
    await initData();
    dataReady = true;
    startRealtime();
    return true;
  } catch (error) {
    renderFatalError(error.message || 'Unable to load Duke Realty data.');
    return false;
  }
}

function startRealtime() {
  if (dataUnsubscribe || !isAuthenticated()) return;
  dataUnsubscribe = subscribeToHouseChanges(() => {
    window.dispatchEvent(new CustomEvent('duke:data-changed'));
  });
}

function stopRealtime() {
  if (dataUnsubscribe) {
    dataUnsubscribe();
    dataUnsubscribe = null;
  }
}

async function handleRoute() {
  const route = getRoute();

  // Cleanup
  if (routeCleanup) {
    routeCleanup();
    routeCleanup = null;
  }
  closePopup();
  if (currentMapInstance) {
    currentMapInstance.destroy();
    currentMapInstance = null;
  }

  // Auth guard
  if (!isAuthenticated() && route !== '/login') {
    navigate('/login');
    return;
  }

  // Already logged in, redirect from login
  if (isAuthenticated() && route === '/login') {
    startPresence(getCurrentUser());
    navigate('/dashboard');
    return;
  }

  if (isAuthenticated()) {
    startPresence(getCurrentUser());
    const ready = await ensureDataReady();
    if (!ready) return;
  }

  const user = getCurrentUser();

  switch (route) {
    case '/login':
      renderLogin();
      break;
    case '/dashboard':
      renderNavbar(user);
      renderDashboard(getContentArea(), (target) => navigate(`/${target}`));
      routeCleanup = bindDataRefresh(() => {
        renderDashboard(getContentArea(), (target) => navigate(`/${target}`));
      });
      break;
    case '/antonia':
      renderNavbar(user);
      renderMapView('antonia');
      break;
    case '/aranya':
      renderNavbar(user);
      renderMapView('aranya');
      break;
    case '/admin':
      if (!hasAdminAccess(user)) {
        navigate('/dashboard');
        return;
      }
      renderNavbar(user);
      routeCleanup = renderAdmin(getContentArea(), (target) => navigate(`/${target}`));
      break;
    case '/super-admin':
      if (user?.role !== 'super_admin') {
        navigate('/dashboard');
        return;
      }
      renderNavbar(user);
      routeCleanup = renderSuperAdmin(getContentArea(), (target) => navigate(`/${target}`));
      break;
    default:
      navigate('/dashboard');
  }
}

window.addEventListener('hashchange', () => {
  handleRoute();
});

boot();

async function boot() {
  app.className = 'app-loading';
  app.innerHTML = '<div class="loading-screen">Loading Duke Realty...</div>';
  await initAuth();
  handleRoute();
}

function bindDataRefresh(callback) {
  const handler = () => callback();
  window.addEventListener('duke:data-changed', handler);
  return () => window.removeEventListener('duke:data-changed', handler);
}

function renderFatalError(message) {
  app.className = 'app-login';
  app.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-logo">
          <img class="login-brand-logo" src="duke-realty-logo.png" alt="Duke Realty" />
        </div>
        <div class="login-error visible">${message}</div>
        <button type="button" class="btn btn-primary" id="retry-load-btn">Retry</button>
      </div>
    </div>
  `;
  document.getElementById('retry-load-btn')?.addEventListener('click', () => {
    dataReady = false;
    handleRoute();
  });
}

// ── Content Area ───────────────────────────────────────────
function getContentArea() {
  let content = document.getElementById('content-area');
  if (!content) {
    content = document.createElement('div');
    content.id = 'content-area';
    app.appendChild(content);
  }
  return content;
}

// ── Login Page ─────────────────────────────────────────────
function renderLogin() {
  app.className = 'app-login';
  app.innerHTML = `
    <div class="login-container" id="login-container">
      <div class="login-card">
        <div class="login-logo">
          <img class="login-brand-logo" src="duke-realty-logo.png" alt="Duke Realty" />
          <p class="text-secondary">Antonia & Aranya — Palanpur B.K.</p>
        </div>
        <form class="login-form" id="login-form" autocomplete="off">
          <div class="login-error" id="login-error"></div>
          <div class="form-group">
            <label class="form-label" for="login-username">Email or Username</label>
            <input
              class="form-input"
              type="text"
              id="login-username"
              placeholder="Enter email or username"
              autocomplete="username"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input
              class="form-input"
              type="password"
              id="login-password"
              placeholder="Enter password"
              autocomplete="current-password"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary">Sign In</button>
          ${!isSupabaseConfigured ? `<p class="login-config-warning">${getSupabaseConfigError()}</p>` : ''}
        </form>
      </div>
    </div>
  `;

  // Form submit
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username')?.value || '';
    const password = document.getElementById('login-password')?.value || '';
    await attemptLogin(username, password);
  });

}

async function attemptLogin(username, password) {
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.querySelector('#login-form button[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
  }

  const result = await login(username, password);

  if (result.success) {
    startPresence(result.user);
    dataReady = false;
    const ready = await ensureDataReady();
    if (!ready) return;
    navigate('/dashboard');
  } else {
    if (errorEl) {
      errorEl.textContent = result.error;
      errorEl.classList.add('visible');
      errorEl.style.animation = 'none';
      errorEl.offsetHeight; // Trigger reflow
      errorEl.style.animation = 'fadeIn 0.2s ease';
    }
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
}

// ── Navigation Bar ─────────────────────────────────────────
function renderNavbar(user) {
  app.innerHTML = '';

  const nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.id = 'navbar';

  const route = getRoute();
  const routeName = route.replace('/', '') || 'dashboard';
  const isMapRoute = route === '/antonia' || route === '/aranya';

  app.className = `app-shell app-route-${routeName}${isMapRoute ? ' app-map' : ''}`;

  nav.innerHTML = `
    <div class="navbar-brand" id="nav-brand">
      <img class="brand-logo" src="duke-realty-logo.png" alt="" aria-hidden="true" />
    </div>
    <button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <div class="navbar-links" id="navbar-links">
      <a href="#/dashboard" class="${route === '/dashboard' ? 'active' : ''}" id="nav-dashboard">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"/></svg>
        </span>
        <span>Dashboard</span>
      </a>
      <a href="#/antonia" class="${route === '/antonia' ? 'active' : ''}" id="nav-antonia">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 6.5 9 4l6 3 5-2.5v13L15 20l-6-3-5 2.5v-13Zm6-.1v9l4 2v-9l-4-2Z"/></svg>
        </span>
        <span>Antonia</span>
      </a>
      <a href="#/aranya" class="${route === '/aranya' ? 'active' : ''}" id="nav-aranya">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 2.2 5.6 2.8-5.6 2.8L6.4 8 12 5.2Zm-6 4.4 5 2.5v6.6l-5-2.5V9.6Zm7 9.1v-6.6l5-2.5v6.6l-5 2.5Z"/></svg>
        </span>
        <span>Aranya</span>
      </a>
      ${hasAdminAccess(user) ? `<a href="#/admin" class="${route === '/admin' ? 'active' : ''}" id="nav-admin">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 2 4 5.5v6.2c0 4 2.6 7.7 8 10.3 5.4-2.6 8-6.3 8-10.3V5.5L12 2Zm0 4.2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-5 10.2c.8-2 2.7-3.2 5-3.2s4.2 1.2 5 3.2c-1.1 1.3-2.8 2.4-5 3.4-2.2-1-3.9-2.1-5-3.4Z"/></svg>
        </span>
        <span>Admin</span>
      </a>` : ''}
      ${user?.role === 'super_admin' ? `<a href="#/super-admin" class="${route === '/super-admin' ? 'active' : ''}" id="nav-super-admin">
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 2 5 5v6c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V5l-7-3Zm0 4 1.2 2.6 2.8.4-2 2  .5 2.8L12 12.5l-2.5 1.3.5-2.8-2-2 2.8-.4L12 6Z"/></svg>
        </span>
        <span>Super Admin</span>
      </a>` : ''}
      <span class="nav-role-badge">${user?.label || user?.role || ''}</span>
      <button id="nav-logout" class="btn btn-ghost btn-sm">
        <span class="nav-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        </span>
        Logout
      </button>
    </div>
  `;

  app.appendChild(nav);

  // Brand click → dashboard
  document.getElementById('nav-brand')?.addEventListener('click', () => navigate('/dashboard'));

  // Hamburger toggle
  document.getElementById('nav-hamburger')?.addEventListener('click', () => {
    document.getElementById('navbar-links')?.classList.toggle('open');
  });

  // Close mobile nav on link click
  nav.querySelectorAll('.navbar-links a').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('navbar-links')?.classList.remove('open');
    });
  });

  // Logout
  document.getElementById('nav-logout')?.addEventListener('click', async () => {
    stopRealtime();
    await stopPresence();
    await logout();
    dataReady = false;
    navigate('/login');
  });

  // Create content area
  const content = document.createElement('div');
  content.id = 'content-area';
  app.appendChild(content);
}

// ── Map View ───────────────────────────────────────────────
function renderMapView(project) {
  const contentArea = getContentArea();
  const config = project === 'antonia' ? ANTONIA_CONFIG : ARANYA_CONFIG;
  const houses = project === 'antonia' ? ANTONIA_HOUSES : ARANYA_HOUSES;

  currentMapInstance = createMap(
    contentArea,
    config,
    houses,
    project,
    (houseId, rectEl) => {
      showHousePopup(project, houseId, () => {
        // On update, refresh map statuses
        currentMapInstance?.refreshStatuses();
      });
    },
  );

  // Back button
  document.getElementById('map-back-btn')?.addEventListener('click', () => {
    navigate('/dashboard');
  });

  routeCleanup = bindDataRefresh(() => {
    currentMapInstance?.refreshStatuses();
  });
}
