/* ============================================================
   Scheme Dashboard - scheme and house construction tracking
   ============================================================ */

import {
  getConstructionProgress,
  getConstructionStageLabel,
  getConstructionStages,
  getHousesList,
  getProjectStats,
  getSchemeConstructionStats,
  getStatusLabel,
} from './data.js';
import { createMap } from './map-renderer.js';
import { showHousePopup } from './popup.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getProgressGroup(progress) {
  if (progress === 0) return 'not-started';
  if (progress === 100) return 'completed';
  return 'in-progress';
}

export function renderSchemeDashboard(container, project, config, mapHouses, navigate) {
  let mapInstance = null;
  let destroyed = false;

  container.innerHTML = `
    <main class="page scheme-dashboard-page page-enter">
      <header class="scheme-header">
        <div>
          <button type="button" class="scheme-back-btn" id="scheme-back-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 11H7.8l4.6-4.6L11 5l-7 7 7 7 1.4-1.4L7.8 13H19v-2Z"/></svg>
            Dashboard
          </button>
          <p class="scheme-eyebrow">Scheme Progress</p>
          <h1>${escapeHtml(config.title)}</h1>
          <p>${escapeHtml(config.subtitle)}</p>
        </div>
        <button type="button" class="btn btn-primary scheme-full-map-btn" id="scheme-full-map-btn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6.5 5-2.5 6 3 5-2.5v13L15 20l-6-3-5 2.5v-13Zm6-.1v9l4 2v-9l-4-2Z"/></svg>
          Open Full Map
        </button>
      </header>

      <section class="scheme-metrics" id="scheme-metrics" aria-label="Scheme progress summary"></section>

      <section class="scheme-overview">
        <div class="scheme-map-panel">
          <div class="scheme-section-heading">
            <div>
              <p class="scheme-section-kicker">Interactive Layout</p>
              <h2>House Map</h2>
            </div>
          </div>
          <div id="scheme-map-mount" class="scheme-map-mount"></div>
        </div>

        <aside class="scheme-stage-panel">
          <div class="scheme-section-heading">
            <div>
              <p class="scheme-section-kicker">Construction</p>
              <h2>Stage Distribution</h2>
            </div>
          </div>
          <div class="scheme-stage-list" id="scheme-stage-list"></div>
        </aside>
      </section>

      <section class="scheme-houses-section">
        <div class="scheme-houses-header">
          <div>
            <p class="scheme-section-kicker">House Tracking</p>
            <h2>Construction Progress</h2>
          </div>
          <span id="scheme-result-count" class="scheme-result-count"></span>
        </div>

        <div class="scheme-filters">
          <label class="scheme-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.7 19.3-4.2-4.2a7 7 0 1 0-1.4 1.4l4.2 4.2 1.4-1.4ZM5 11a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z"/></svg>
            <input type="search" id="scheme-house-search" placeholder="Search house or stage" aria-label="Search house or stage" />
          </label>
          <select id="scheme-status-filter" aria-label="Filter by booking status">
            <option value="all">All booking statuses</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="hold">Hold</option>
          </select>
          <select id="scheme-progress-filter" aria-label="Filter by construction progress">
            <option value="all">All construction progress</option>
            <option value="not-started">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div class="scheme-table-wrap">
          <table class="scheme-house-table">
            <thead>
              <tr>
                <th>House</th>
                <th>Booking Status</th>
                <th>Construction Stage</th>
                <th>Progress</th>
                <th>Target Date</th>
                <th><span class="sr-only">Open details</span></th>
              </tr>
            </thead>
            <tbody id="scheme-house-rows"></tbody>
          </table>
        </div>
        <div class="scheme-mobile-list" id="scheme-mobile-list"></div>
        <div class="scheme-empty-state" id="scheme-empty-state" hidden>No houses match these filters.</div>
      </section>
    </main>
  `;

  const metricsEl = container.querySelector('#scheme-metrics');
  const stageListEl = container.querySelector('#scheme-stage-list');
  const rowsEl = container.querySelector('#scheme-house-rows');
  const mobileListEl = container.querySelector('#scheme-mobile-list');
  const resultCountEl = container.querySelector('#scheme-result-count');
  const emptyStateEl = container.querySelector('#scheme-empty-state');
  const searchEl = container.querySelector('#scheme-house-search');
  const statusFilterEl = container.querySelector('#scheme-status-filter');
  const progressFilterEl = container.querySelector('#scheme-progress-filter');

  const openHouse = (houseId) => {
    mapInstance?.highlightHouse(houseId);
    showHousePopup(project, houseId, refresh);
  };

  mapInstance = createMap(
    container.querySelector('#scheme-map-mount'),
    config,
    mapHouses,
    project,
    openHouse,
    { embedded: true },
  );

  function getFilteredHouses() {
    const query = searchEl.value.trim().toLowerCase();
    return getHousesList(project).filter((house) => {
      const stage = getConstructionStageLabel(house.constructionStage);
      const progress = getConstructionProgress(house.constructionStage);
      const matchesQuery = !query
        || String(house.id).includes(query)
        || stage.toLowerCase().includes(query);
      const matchesStatus = statusFilterEl.value === 'all' || house.status === statusFilterEl.value;
      const matchesProgress = progressFilterEl.value === 'all'
        || getProgressGroup(progress) === progressFilterEl.value;
      return matchesQuery && matchesStatus && matchesProgress;
    });
  }

  function renderMetrics() {
    const construction = getSchemeConstructionStats(project);
    const booking = getProjectStats(project);
    const bookingProgress = booking.total ? Math.round((booking.booked / booking.total) * 100) : 0;

    metricsEl.innerHTML = `
      <article class="scheme-metric scheme-metric-primary">
        <span>Overall Construction</span>
        <strong>${construction.overallProgress}%</strong>
        <div class="scheme-metric-progress"><i style="width:${construction.overallProgress}%"></i></div>
      </article>
      <article class="scheme-metric">
        <span>Booking Progress</span>
        <strong>${bookingProgress}%</strong>
        <small>${booking.booked} of ${booking.total} houses booked</small>
      </article>
      <article class="scheme-metric">
        <span>In Progress</span>
        <strong>${construction.inProgress}</strong>
        <small>${construction.notStarted} not started</small>
      </article>
      <article class="scheme-metric">
        <span>Completed</span>
        <strong>${construction.completed}</strong>
        <small>of ${construction.total} houses</small>
      </article>
    `;
  }

  function renderStages() {
    const houses = getHousesList(project);
    const configuredStages = getConstructionStages();
    const counts = new Map(configuredStages.map(stage => [stage, 0]));

    houses.forEach((house) => {
      const stage = getConstructionStageLabel(house.constructionStage);
      counts.set(stage, (counts.get(stage) || 0) + 1);
    });

    const populatedStages = [...counts.entries()].filter(([, count]) => count > 0);
    stageListEl.innerHTML = populatedStages.map(([stage, count]) => {
      const percentage = houses.length ? Math.round((count / houses.length) * 100) : 0;
      return `
        <div class="scheme-stage-row">
          <div><span>${escapeHtml(stage)}</span><strong>${count}</strong></div>
          <div class="scheme-stage-bar"><i style="width:${percentage}%"></i></div>
        </div>
      `;
    }).join('');
  }

  function renderHouseLists() {
    const houses = getFilteredHouses();
    const total = getHousesList(project).length;
    resultCountEl.textContent = `${houses.length} of ${total} houses`;
    emptyStateEl.hidden = houses.length > 0;

    rowsEl.innerHTML = houses.map((house) => {
      const progress = getConstructionProgress(house.constructionStage);
      const stage = getConstructionStageLabel(house.constructionStage);
      const status = house.status || 'available';
      return `
        <tr data-house-id="${house.id}" tabindex="0" aria-label="Open House ${house.id} details">
          <td><strong>House ${house.id}</strong><small>${escapeHtml(house.type || house.plotSize || '-')}</small></td>
          <td><span class="status-badge ${escapeHtml(status)}">${escapeHtml(getStatusLabel(status))}</span></td>
          <td>${escapeHtml(stage)}</td>
          <td>
            <div class="house-progress-cell">
              <div class="house-progress-bar"><i style="width:${progress}%"></i></div>
              <strong>${progress}%</strong>
            </div>
          </td>
          <td>${escapeHtml(formatDate(house.targetDate))}</td>
          <td><svg class="scheme-row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6-1.4 1.4 4.6 4.6-4.6 4.6L9 18Z"/></svg></td>
        </tr>
      `;
    }).join('');

    mobileListEl.innerHTML = houses.map((house) => {
      const progress = getConstructionProgress(house.constructionStage);
      const stage = getConstructionStageLabel(house.constructionStage);
      const status = house.status || 'available';
      return `
        <button type="button" class="scheme-mobile-house" data-house-id="${house.id}">
          <span class="scheme-mobile-house-top">
            <strong>House ${house.id}</strong>
            <span class="status-badge ${escapeHtml(status)}">${escapeHtml(getStatusLabel(status))}</span>
          </span>
          <span class="scheme-mobile-stage">${escapeHtml(stage)}</span>
          <span class="house-progress-cell">
            <span class="house-progress-bar"><i style="width:${progress}%"></i></span>
            <strong>${progress}%</strong>
          </span>
        </button>
      `;
    }).join('');
  }

  function refresh() {
    if (destroyed) return;
    renderMetrics();
    renderStages();
    renderHouseLists();
    mapInstance?.refreshStatuses();
  }

  function handleHouseActivation(event) {
    const row = event.target.closest('[data-house-id]');
    if (!row) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openHouse(Number(row.dataset.houseId));
  }

  const handleDataChange = () => refresh();
  window.addEventListener('duke:data-changed', handleDataChange);
  [searchEl, statusFilterEl, progressFilterEl].forEach((control) => {
    control.addEventListener('input', renderHouseLists);
    control.addEventListener('change', renderHouseLists);
  });
  rowsEl.addEventListener('click', handleHouseActivation);
  rowsEl.addEventListener('keydown', handleHouseActivation);
  mobileListEl.addEventListener('click', handleHouseActivation);
  container.querySelector('#scheme-back-btn').addEventListener('click', () => navigate('/dashboard'));
  container.querySelector('#scheme-full-map-btn').addEventListener('click', () => navigate(`/${project}/map`));

  refresh();

  return () => {
    destroyed = true;
    window.removeEventListener('duke:data-changed', handleDataChange);
    mapInstance?.destroy();
  };
}
