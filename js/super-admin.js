import { getCurrentUser } from './auth.js';
import { refreshOnlineUsers, subscribePresence } from './presence.js';

function createEl(tagName, className, text) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function formatRoute(route) {
  return (route || '#/dashboard').replace('#/', '') || 'dashboard';
}

function formatLastSeen(isoString) {
  const timestamp = Date.parse(isoString || '');
  if (!timestamp) return 'Just now';

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function roleLabel(role) {
  const label = String(role || '').replace(/_/g, ' ');
  return label ? label.replace(/\b\w/g, char => char.toUpperCase()) : 'Unknown role';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function describePresenceError(error) {
  const message = error?.message || '';
  if (message.includes('get_online_users') || message.includes('schema cache')) {
    return {
      title: 'Live users setup is missing',
      detail: 'Run supabase/super_admin_live_users_fix.sql in Supabase SQL Editor, then refresh this page.',
    };
  }

  if (message.toLowerCase().includes('only super administrators')) {
    return {
      title: 'Super admin permission required',
      detail: 'This account is signed in, but Supabase is not returning a super_admin role for it.',
    };
  }

  return {
    title: 'Unable to load live users',
    detail: message || 'Check the Supabase function and permissions, then try again.',
  };
}

export function renderSuperAdmin(container, navigate) {
  const user = getCurrentUser();
  if (!user || user.role !== 'super_admin') {
    container.innerHTML = '<div class="page"><p>Access denied. Super admin role required.</p></div>';
    return null;
  }

  container.innerHTML = '';
  container.className = 'page super-admin-page page-enter';
  container.innerHTML = `
    <header class="super-admin-header">
      <div class="super-admin-title-group">
        <button class="btn btn-ghost btn-sm" id="super-admin-back-btn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Dashboard
        </button>
        <h1>Super Admin</h1>
        <p class="text-secondary">Monitor active website sessions, open routes, visibility, and recent heartbeat status.</p>
      </div>
      <div class="super-admin-metrics" aria-label="Live user summary">
        <div class="super-admin-count">
          <strong id="online-user-count">0</strong>
          <span>Online</span>
        </div>
        <div class="super-admin-status-card">
          <span class="status-pulse" aria-hidden="true"></span>
          <div>
            <strong id="online-system-status">Checking</strong>
            <span id="online-system-detail">Waiting for first heartbeat</span>
          </div>
        </div>
      </div>
    </header>

    <section class="super-admin-health" aria-label="Live monitoring details">
      <div>
        <span>Refresh window</span>
        <strong>90 seconds</strong>
      </div>
      <div>
        <span>Polling</span>
        <strong>Every 10 seconds</strong>
      </div>
      <div>
        <span>Session source</span>
        <strong>Supabase presence</strong>
      </div>
    </section>

    <section class="super-admin-card" aria-live="polite">
      <div class="super-admin-card-header">
        <div>
          <h2>Active Users</h2>
          <p>Each row represents the latest active tab for a signed-in account.</p>
        </div>
        <div class="super-admin-card-actions">
          <span id="online-refresh-time">Waiting for online users...</span>
          <button class="btn btn-secondary btn-sm" id="online-refresh-btn" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3Z"/></svg>
            Refresh
          </button>
        </div>
      </div>
      <div class="online-users-list" id="online-users-list">
        <div class="online-state online-empty">
          <span class="online-state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3 4 7v6c0 4.4 3 7.5 8 8 5-.5 8-3.6 8-8V7l-8-4Zm0 2.2 5.8 2.6V13c0 3.1-2 5.4-5.8 6-3.8-.6-5.8-2.9-5.8-6V7.8L12 5.2Z"/></svg>
          </span>
          <strong>Waiting for online users</strong>
          <span>Signed-in sessions will appear here after their first heartbeat.</span>
        </div>
      </div>
    </section>
  `;

  document.getElementById('super-admin-back-btn')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('online-refresh-btn')?.addEventListener('click', async () => {
    const button = document.getElementById('online-refresh-btn');
    if (button) {
      button.disabled = true;
      button.classList.add('is-loading');
    }
    await refreshOnlineUsers();
    if (button) {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  });

  function renderUsers(users) {
    const list = document.getElementById('online-users-list');
    const count = document.getElementById('online-user-count');
    const refresh = document.getElementById('online-refresh-time');
    const status = document.getElementById('online-system-status');
    const statusDetail = document.getElementById('online-system-detail');
    if (!list || !count || !refresh) return;

    count.textContent = String(users.length);
    refresh.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    if (status) status.textContent = 'Connected';
    if (statusDetail) statusDetail.textContent = `${users.length} active ${users.length === 1 ? 'session' : 'sessions'}`;

    if (users.length === 0) {
      list.innerHTML = `
        <div class="online-state online-empty">
          <span class="online-state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3 4 7v6c0 4.4 3 7.5 8 8 5-.5 8-3.6 8-8V7l-8-4Zm0 2.2 5.8 2.6V13c0 3.1-2 5.4-5.8 6-3.8-.6-5.8-2.9-5.8-6V7.8L12 5.2Z"/></svg>
          </span>
          <strong>No active users detected</strong>
          <span>Users appear after signing in and sending a heartbeat within the last 90 seconds.</span>
        </div>
      `;
      return;
    }

    list.replaceChildren(...users.map((onlineUser) => {
      const row = createEl('article', 'online-user-row');
      const main = createEl('div', 'online-user-main');
      const dot = createEl('span', 'online-dot');
      dot.setAttribute('aria-hidden', 'true');

      const identity = createEl('div');
      const name = createEl('strong', '', onlineUser.name || onlineUser.username || onlineUser.email || 'Unknown user');
      const detailText = [
        onlineUser.username || onlineUser.email || 'No username',
        onlineUser.email && onlineUser.username !== onlineUser.email ? onlineUser.email : '',
      ].filter(Boolean).join(' · ');
      const details = createEl('span', '', detailText);

      identity.append(name, details);
      main.append(dot, identity);

      const meta = createEl('div', 'online-user-meta');
      const tabCount = Number(onlineUser.tab_count || 1);
      [
        roleLabel(onlineUser.role),
        formatRoute(onlineUser.route),
        onlineUser.visibility || 'visible',
        `${tabCount} tab${tabCount === 1 ? '' : 's'}`,
        formatLastSeen(onlineUser.last_seen_at),
      ].forEach(value => meta.appendChild(createEl('span', '', value)));

      row.append(main, meta);
      return row;
    }));
  }

  function renderPresenceError(error) {
    const list = document.getElementById('online-users-list');
    const count = document.getElementById('online-user-count');
    const refresh = document.getElementById('online-refresh-time');
    const status = document.getElementById('online-system-status');
    const statusDetail = document.getElementById('online-system-detail');
    const errorCopy = describePresenceError(error);
    if (count) count.textContent = '0';
    if (refresh) refresh.textContent = 'Unable to load online users';
    if (status) status.textContent = 'Needs setup';
    if (statusDetail) statusDetail.textContent = 'Database function unavailable';
    if (list) {
      list.innerHTML = `
        <div class="online-state online-error">
          <span class="online-state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 2 2 20h20L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V8h2v5Z"/></svg>
          </span>
          <strong>${escapeHtml(errorCopy.title)}</strong>
          <span>${escapeHtml(errorCopy.detail)}</span>
        </div>
      `;
    }
  }

  const unsubscribePresence = subscribePresence(renderUsers, renderPresenceError);
  const timer = window.setInterval(() => {
    const refresh = document.getElementById('online-refresh-time');
    if (refresh) refresh.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }, 15000);

  return () => {
    unsubscribePresence();
    window.clearInterval(timer);
  };
}
