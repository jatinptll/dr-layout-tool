/* ============================================================
   Dashboard Module — Landing page after login
   ============================================================ */

import { getCurrentUser } from './auth.js';
import { getProjectStats } from './data.js';
import { hasAdminAccess, hasSuperAdminAccess } from './roles.js';

/**
 * Render the dashboard view into the container
 * @param {HTMLElement} container
 * @param {Function} navigate - Router navigation function
 */
export function renderDashboard(container, navigate) {
  const user = getCurrentUser();
  if (!user) return;

  const antoniaStats = getProjectStats('antonia');
  const aranyaStats = getProjectStats('aranya');
  const totalHouses = antoniaStats.total + aranyaStats.total;
  const totalAvailable = antoniaStats.available + aranyaStats.available;
  const totalBooked = antoniaStats.booked + aranyaStats.booked;

  container.innerHTML = '';
  container.className = 'page dashboard-page page-enter';

  container.innerHTML = `
    <header class="dashboard-header">
      <div>
        <h1>Welcome, <span class="text-accent">${user.name}</span></h1>
        <p class="text-secondary">Duke Realty Management Dashboard — Antonia & Aranya at Palanpur B.K.</p>
      </div>
    </header>

    <section class="summary-stats" aria-label="Portfolio summary">
      ${summaryCard('Total Houses', totalHouses, 'gold', '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5Z"/>')}
      ${summaryCard('Available', totalAvailable, 'green', '<path d="m9.2 15.4-3.6-3.6-1.4 1.4 5 5 10-10-1.4-1.4-8.6 8.6Z"/>')}
      ${summaryCard('Booked', totalBooked, 'pink', '<path d="M7 2h2v3h6V2h2v3h3v16H4V5h3V2Zm11 8H6v9h12v-9Z"/>')}
      ${summaryCard('Projects', 2, 'blue', '<path d="M12 2 3 6.5 12 11l9-4.5L12 2Zm-7 9 7 3.5 7-3.5v3l-7 3.5L5 14v-3Zm0 5 7 3.5 7-3.5v3l-7 3.5L5 19v-3Z"/>')}
    </section>

    <section class="dashboard-grid" aria-label="Projects">
      ${projectCard('Antonia', 'Palanpur B.K. — 34 Houses', 'antonia-layout.png', antoniaStats)}
      ${projectCard('Aranya', 'Palanpur B.K. — 68 Houses', 'aranya-layout.png', aranyaStats)}
    </section>

    ${hasAdminAccess(user) ? `
      <section class="card dashboard-actions-card">
        <div class="card-header">
          <h2 class="card-title">Quick Actions</h2>
        </div>
        <div class="dashboard-actions">
          <button class="btn btn-secondary" id="dash-admin-btn" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5.5v6.2c0 4 2.6 7.7 8 10.3 5.4-2.6 8-6.3 8-10.3V5.5L12 2Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-5 10.3c.9-1.9 2.8-3.1 5-3.1s4.1 1.2 5 3.1c-1.2 1.2-2.8 2.3-5 3.3-2.2-1-3.8-2.1-5-3.3Z"/></svg>
            Admin Panel
          </button>
          ${hasSuperAdminAccess(user) ? `
            <button class="btn btn-secondary" id="dash-super-admin-btn" type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 5 5v6c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V5l-7-3Zm0 4 1.2 2.6 2.8.4-2 2 .5 2.8L12 12.5l-2.5 1.3.5-2.8-2-2 2.8-.4L12 6Z"/></svg>
              Super Admin
            </button>
          ` : ''}
        </div>
      </section>
    ` : ''}
  `;

  container.querySelector('[data-project="antonia"]')?.addEventListener('click', () => navigate('antonia'));
  container.querySelector('[data-project="aranya"]')?.addEventListener('click', () => navigate('aranya'));
  document.getElementById('dash-admin-btn')?.addEventListener('click', () => navigate('admin'));
  document.getElementById('dash-super-admin-btn')?.addEventListener('click', () => navigate('super-admin'));
}

function summaryCard(label, value, tone, iconPath) {
  return `
    <article class="summary-card">
      <span class="summary-icon ${tone}" aria-hidden="true">
        <svg viewBox="0 0 24 24">${iconPath}</svg>
      </span>
      <span class="summary-data">
        <strong>${value}</strong>
        <span>${label}</span>
      </span>
    </article>
  `;
}

function projectCard(title, subtitle, imageSrc, stats) {
  const project = title.toLowerCase();
  const pct = stats.total > 0 ? Math.round((stats.booked / stats.total) * 100) : 0;

  return `
    <article class="project-card card-clickable" data-project="${project}" tabindex="0" role="button">
      <img class="project-card-image" src="${imageSrc}" alt="${title} layout" loading="lazy" />
      <div class="project-card-body">
        <div class="project-card-title">${title}</div>
        <div class="project-card-subtitle">${subtitle}</div>
        <div class="project-progress">
          <span>Booking Progress</span>
          <strong>${pct}%</strong>
          <div class="project-progress-bar"><i style="width:${pct}%"></i></div>
        </div>
        <div class="project-stats">
          <span><strong>${stats.total}</strong><small>Total</small></span>
          <span><strong>${stats.available}</strong><small>Available</small></span>
          <span><strong>${stats.booked}</strong><small>Booked</small></span>
        </div>
      </div>
    </article>
  `;
}
