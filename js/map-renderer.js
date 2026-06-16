/* ============================================================
   Map Renderer — SVG overlay engine with zoom/pan
   Renders an interactive map with house regions on top of
   the layout image. Supports mouse & touch interactions.
   ============================================================ */

import { getHouse } from './data.js';

/**
 * Create and mount an interactive map
 * @param {HTMLElement} container - The element to render into
 * @param {object} config - Map config (image, dimensions, title, etc.)
 * @param {Array} houses - Array of { id, x, y, w, h } in percentage coords
 * @param {string} project - 'antonia' or 'aranya'
 * @param {Function} onHouseClick - Callback when a house is clicked
 */
export function createMap(container, config, houses, project, onHouseClick) {
  // State
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  const MIN_SCALE = 0.3;
  const MAX_SCALE = 5;
  const ZOOM_FACTOR = 0.15;

  // Build DOM
  container.innerHTML = '';
  container.className = 'map-page page-enter';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'map-toolbar';
  toolbar.innerHTML = `
    <div class="map-toolbar-left">
      <button class="btn btn-ghost btn-sm" id="map-back-btn" aria-label="Back to dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <div class="map-title-block">
        <h2>${config.title}</h2>
        <span class="text-muted" style="font-size:0.8rem">${config.subtitle}</span>
      </div>
    </div>
    <div class="map-toolbar-right">
      <div class="map-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input type="text" id="map-search-input" placeholder="House #..." aria-label="Search house number" />
      </div>
    </div>
  `;
  container.appendChild(toolbar);

  // Viewport (scrollable/zoomable area)
  const viewport = document.createElement('div');
  viewport.className = 'map-viewport';
  viewport.id = 'map-viewport';

  // Inner container (scaled)
  const inner = document.createElement('div');
  inner.className = 'map-inner';
  inner.id = 'map-inner';

  // Layout image
  const img = document.createElement('img');
  img.className = 'map-image';
  img.src = config.image;
  img.alt = `${config.title} Site Layout`;
  img.draggable = false;
  img.id = 'map-layout-image';

  // SVG overlay
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-svg-overlay');
  svg.setAttribute('viewBox', `0 0 ${config.imageWidth} ${config.imageHeight}`);
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  svg.id = 'map-svg-overlay';

  // SVG defs for booked pattern
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <pattern id="booked-pattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y="0" x2="0" y2="8" stroke="rgba(255,43,214,0.42)" stroke-width="3"/>
    </pattern>
    <pattern id="booked-pattern-hover" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y="0" x2="0" y2="8" stroke="rgba(0,229,255,0.65)" stroke-width="3"/>
    </pattern>
  `;
  svg.appendChild(defs);

  // Create house regions
  const houseElements = new Map();
  const seenIds = new Set();

  for (const house of houses) {
    // Skip duplicate IDs (from imperfect coordinate mapping)
    if (seenIds.has(house.id)) continue;
    seenIds.add(house.id);

    const bounds = getHouseBounds(house);
    let region;

    if (house.points) {
      region = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      region.setAttribute('points', house.points
        .map(point => `${(point[0] / 100) * config.imageWidth},${(point[1] / 100) * config.imageHeight}`)
        .join(' '));
    } else {
      region = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      region.setAttribute('x', (house.x / 100) * config.imageWidth);
      region.setAttribute('y', (house.y / 100) * config.imageHeight);
      region.setAttribute('width', (house.w / 100) * config.imageWidth);
      region.setAttribute('height', (house.h / 100) * config.imageHeight);
      region.setAttribute('rx', '4');
    }

    region.setAttribute('class', 'house-region');
    region.setAttribute('data-id', house.id);
    region.id = `house-${project}-${house.id}`;

    // Check if booked
    const houseData = getHouse(project, house.id);
    if (houseData && houseData.status === 'booked') {
      region.classList.add('booked');
    }

    // Click handler
    region.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onHouseClick) onHouseClick(house.id, region);
    });

    svg.appendChild(region);

    houseElements.set(house.id, region);
  }

  inner.appendChild(img);
  inner.appendChild(svg);
  viewport.appendChild(inner);
  container.appendChild(viewport);

  // Zoom controls
  const controls = document.createElement('div');
  controls.className = 'map-controls';
  controls.innerHTML = `
    <button id="map-zoom-in" title="Zoom in" aria-label="Zoom in">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>
    </button>
    <button id="map-zoom-out" title="Zoom out" aria-label="Zoom out">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5v-2Z"/></svg>
    </button>
    <button id="map-fit" title="Fit to view" aria-label="Fit to view">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h6v2H7v4H5V5Zm8 0h6v6h-2V7h-4V5ZM7 13v4h4v2H5v-6h2Zm12 0v6h-6v-2h4v-4h2Z"/></svg>
    </button>
  `;
  viewport.appendChild(controls);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = `
    <div class="legend-item">
      <div class="legend-swatch available"></div>
      <span>Available</span>
    </div>
    <div class="legend-item">
      <div class="legend-swatch booked"></div>
      <span>Booked</span>
    </div>
  `;
  viewport.appendChild(legend);

  // ── Transform helpers ────────────────────────────────────
  function applyTransform(smooth = false) {
    if (smooth) {
      inner.classList.add('smooth-transition');
      setTimeout(() => inner.classList.remove('smooth-transition'), 300);
    }
    inner.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function fitToView() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (!vw || !vh) return;

    const iw = img.naturalWidth || config.imageWidth;
    const ih = img.naturalHeight || config.imageHeight;
    scale = Math.min(vw / iw, vh / ih, 1);
    panX = (vw - iw * scale) / 2;
    panY = window.matchMedia('(max-width: 768px)').matches
      ? 0
      : (vh - ih * scale) / 2;
    applyTransform(true);
  }

  function scheduleFitToView() {
    requestAnimationFrame(() => {
      fitToView();
      setTimeout(fitToView, 120);
    });
  }

  // Wait for image to load then fit
  if (img.complete) {
    scheduleFitToView();
  } else {
    img.addEventListener('load', scheduleFitToView, { once: true });
  }

  const resizeObserver = new ResizeObserver(scheduleFitToView);
  resizeObserver.observe(viewport);

  // ── Mouse Zoom ───────────────────────────────────────────
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const prevScale = scale;
    const delta = e.deltaY > 0 ? -ZOOM_FACTOR : ZOOM_FACTOR;
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (1 + delta)));

    // Zoom towards mouse position
    const ratio = scale / prevScale;
    panX = mouseX - (mouseX - panX) * ratio;
    panY = mouseY - (mouseY - panY) * ratio;

    applyTransform();
  }, { passive: false });

  // ── Mouse Pan ────────────────────────────────────────────
  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = panX;
    startPanY = panY;
    viewport.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = startPanX + (e.clientX - startX);
    panY = startPanY + (e.clientY - startY);
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
    viewport.style.cursor = '';
  });

  // ── Touch Pan & Pinch Zoom ───────────────────────────────
  let lastTouchDist = 0;
  let lastTouchCenter = { x: 0, y: 0 };

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isPanning = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startPanX = panX;
      startPanY = panY;
    } else if (e.touches.length === 2) {
      isPanning = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.hypot(dx, dy);
      lastTouchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
      panX = startPanX + (e.touches[0].clientX - startX);
      panY = startPanY + (e.touches[0].clientY - startY);
      applyTransform();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };

      if (lastTouchDist > 0) {
        const prevScale = scale;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * (dist / lastTouchDist)));
        const ratio = scale / prevScale;
        const rect = viewport.getBoundingClientRect();
        const cx = center.x - rect.left;
        const cy = center.y - rect.top;
        panX = cx - (cx - panX) * ratio;
        panY = cy - (cy - panY) * ratio;
        applyTransform();
      }

      lastTouchDist = dist;
      lastTouchCenter = center;
    }
  }, { passive: false });

  viewport.addEventListener('touchend', () => {
    isPanning = false;
    lastTouchDist = 0;
  }, { passive: true });

  // ── Button Controls ──────────────────────────────────────
  document.getElementById('map-zoom-in')?.addEventListener('click', () => {
    const prevScale = scale;
    scale = Math.min(MAX_SCALE, scale * 1.3);
    const vw = viewport.clientWidth / 2;
    const vh = viewport.clientHeight / 2;
    const ratio = scale / prevScale;
    panX = vw - (vw - panX) * ratio;
    panY = vh - (vh - panY) * ratio;
    applyTransform(true);
  });

  document.getElementById('map-zoom-out')?.addEventListener('click', () => {
    const prevScale = scale;
    scale = Math.max(MIN_SCALE, scale / 1.3);
    const vw = viewport.clientWidth / 2;
    const vh = viewport.clientHeight / 2;
    const ratio = scale / prevScale;
    panX = vw - (vw - panX) * ratio;
    panY = vh - (vh - panY) * ratio;
    applyTransform(true);
  });

  document.getElementById('map-fit')?.addEventListener('click', fitToView);

  // ── Search ───────────────────────────────────────────────
  const searchInput = document.getElementById('map-search-input');
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim();
    // Remove all highlights
    houseElements.forEach(el => el.classList.remove('highlighted'));

    if (!query) return;

    const num = parseInt(query, 10);
    if (isNaN(num)) return;

    const el = houseElements.get(num);
    if (!el) return;

    el.classList.add('highlighted');

    // Pan to center the house
    focusHouse(num);
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const num = parseInt(searchInput.value.trim(), 10);
      if (!isNaN(num) && houseElements.has(num)) {
        if (onHouseClick) onHouseClick(num, houseElements.get(num));
      }
    }
  });

  // ── Public API ───────────────────────────────────────────
  return {
    fitToView,
    highlightHouse(id) {
      houseElements.forEach(el => el.classList.remove('highlighted'));
      const el = houseElements.get(id);
      if (el) el.classList.add('highlighted');
    },
    refreshStatuses() {
      houseElements.forEach((el, id) => {
        const data = getHouse(project, id);
        el.classList.toggle('booked', data?.status === 'booked');
      });
    },
    destroy() {
      resizeObserver.disconnect();
      container.innerHTML = '';
    },
  };

  function getHouseBounds(house) {
    if (!house.points) {
      return { x: house.x, y: house.y, w: house.w, h: house.h };
    }

    const xs = house.points.map(point => point[0]);
    const ys = house.points.map(point => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function focusHouse(id) {
    const houseObj = houses.find(h => h.id === id);
    if (!houseObj) return;

    const bounds = getHouseBounds(houseObj);
    const iw = img.naturalWidth || config.imageWidth;
    const ih = img.naturalHeight || config.imageHeight;
    const cx = (bounds.x + bounds.w / 2) / 100 * iw * scale;
    const cy = (bounds.y + bounds.h / 2) / 100 * ih * scale;
    panX = viewport.clientWidth / 2 - cx;
    panY = viewport.clientHeight / 2 - cy;
    applyTransform(true);
  }
}
