/* ============================================================
   Admin Module — CRUD panel for house data management
   Admin-only: table view, edit modal, export/import, reset
   ============================================================ */

import { getCurrentUser } from './auth.js';
import {
  getHousesList, getHouse, updateHouse,
  getEditableFields, exportData, importData, resetData,
} from './data.js';

/**
 * Render the admin panel
 * @param {HTMLElement} container
 * @param {Function} navigate
 */
export function renderAdmin(container, navigate) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    container.innerHTML = '<div class="page"><p>Access denied. Admin role required.</p></div>';
    return;
  }

  let currentProject = 'antonia';
  let searchQuery = '';
  let statusFilter = '';

  container.innerHTML = '';
  container.className = 'admin-page page-enter';

  // Header
  const header = document.createElement('div');
  header.className = 'admin-header';
  header.innerHTML = `
    <div>
      <button class="btn btn-ghost btn-sm" id="admin-back-btn" style="margin-bottom:var(--space-sm)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Dashboard
      </button>
      <h1>Admin Panel</h1>
    </div>
    <div class="admin-actions">
      <button class="btn btn-secondary btn-sm" id="admin-export-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        Export
      </button>
      <label class="btn btn-secondary btn-sm" style="cursor:pointer" for="admin-import-input">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
        Import
        <input type="file" id="admin-import-input" accept=".json" style="display:none" />
      </label>
      <button class="btn btn-danger btn-sm" id="admin-reset-btn">
        Reset Data
      </button>
    </div>
  `;
  container.appendChild(header);

  // Filters
  const filters = document.createElement('div');
  filters.className = 'admin-filters';
  filters.innerHTML = `
    <select class="form-select" id="admin-project-select" aria-label="Select project">
      <option value="antonia">Antonia (34 houses)</option>
      <option value="aranya">Aranya (68 houses)</option>
    </select>
    <select class="form-select" id="admin-status-filter" aria-label="Filter by status">
      <option value="">All Status</option>
      <option value="available">Available</option>
      <option value="booked">Booked</option>
    </select>
    <input type="text" class="form-input" id="admin-search" placeholder="Search by house #, customer..." aria-label="Search houses" style="max-width:250px" />
  `;
  container.appendChild(filters);

  // Table container
  const tableWrap = document.createElement('div');
  tableWrap.className = 'admin-table-wrap';
  tableWrap.id = 'admin-table-wrap';
  container.appendChild(tableWrap);

  // ── Event Listeners ──────────────────────────────────────
  document.getElementById('admin-back-btn')?.addEventListener('click', () => navigate('dashboard'));

  document.getElementById('admin-project-select')?.addEventListener('change', (e) => {
    currentProject = e.target.value;
    renderTable();
  });

  document.getElementById('admin-status-filter')?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    renderTable();
  });

  document.getElementById('admin-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTable();
  });

  document.getElementById('admin-export-btn')?.addEventListener('click', () => {
    exportData();
    showToast('Data exported successfully', 'success');
  });

  document.getElementById('admin-import-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importData(reader.result);
      if (result.success) {
        showToast('Data imported successfully', 'success');
        renderTable();
      } else {
        showToast(`Import failed: ${result.error}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  });

  document.getElementById('admin-reset-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      resetData();
      showToast('Data reset to defaults', 'info');
      renderTable();
    }
  });

  // ── Table Rendering ──────────────────────────────────────
  function renderTable() {
    let houses = getHousesList(currentProject);

    // Apply status filter
    if (statusFilter) {
      houses = houses.filter(h => h.status === statusFilter);
    }

    // Apply search
    if (searchQuery) {
      houses = houses.filter(h => {
        return (
          String(h.id).includes(searchQuery) ||
          (h.customerName || '').toLowerCase().includes(searchQuery) ||
          (h.contractorName || '').toLowerCase().includes(searchQuery) ||
          (h.type || '').toLowerCase().includes(searchQuery) ||
          (h.facing || '').toLowerCase().includes(searchQuery)
        );
      });
    }

    const table = document.createElement('table');
    table.className = 'admin-table';

    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Status</th>
          <th>Type</th>
          <th>Plot Size</th>
          <th>Facing</th>
          <th>Customer</th>
          <th>Phone</th>
          <th>Price</th>
          <th>Stage</th>
          <th>Contractor</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');
    for (const house of houses) {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.innerHTML = `
        <td style="font-weight:600;color:var(--accent)">${house.id}</td>
        <td><span class="status-badge ${house.status}">${house.status === 'booked' ? 'Booked' : 'Available'}</span></td>
        <td>${house.type || '—'}</td>
        <td>${house.plotSize || '—'}</td>
        <td>${house.facing || '—'}</td>
        <td>${house.customerName || '—'}</td>
        <td>${house.customerPhone || '—'}</td>
        <td>${house.price || '—'}</td>
        <td>${house.constructionStage || '—'}</td>
        <td>${house.contractorName || '—'}</td>
      `;
      row.addEventListener('click', () => showEditModal(currentProject, house.id));
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    tableWrap.innerHTML = '';
    tableWrap.appendChild(table);

    // Empty state
    if (houses.length === 0) {
      tableWrap.innerHTML = `
        <div style="padding:var(--space-2xl);text-align:center;color:var(--text-muted)">
          No houses match your filters.
        </div>
      `;
    }
  }

  // ── Edit Modal ───────────────────────────────────────────
  function showEditModal(project, id) {
    const house = getHouse(project, id);
    if (!house) return;

    const sections = getEditableFields('admin');

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'admin-edit-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';

    // Header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
      <h2>Edit House ${id} — <span class="text-accent">${currentProject === 'antonia' ? 'Antonia' : 'Aranya'}</span></h2>
      <button class="popup-close" id="modal-close-btn" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    modal.appendChild(modalHeader);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';

    for (const section of sections) {
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'modal-section-title';
      sectionTitle.textContent = section.section;
      body.appendChild(sectionTitle);

      const grid = document.createElement('div');
      grid.className = 'modal-field-grid';

      for (const field of section.fields) {
        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = field.label;
        label.htmlFor = `edit-${field.key}`;
        group.appendChild(label);

        let input;
        if (field.type === 'select') {
          input = document.createElement('select');
          input.className = 'form-select';
          for (const opt of (field.options || [])) {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt || '(none)';
            if (opt === house[field.key]) option.selected = true;
            input.appendChild(option);
          }
        } else if (field.type === 'textarea') {
          input = document.createElement('textarea');
          input.className = 'form-textarea';
          input.value = house[field.key] || '';
          input.rows = 3;
        } else if (field.type === 'date') {
          input = document.createElement('input');
          input.type = 'date';
          input.className = 'form-input';
          input.value = house[field.key] || '';
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.className = 'form-input';
          input.value = house[field.key] || '';
          input.placeholder = field.label;
        }

        input.id = `edit-${field.key}`;
        input.name = field.key;
        group.appendChild(input);
        grid.appendChild(group);
      }

      body.appendChild(grid);
    }

    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="modal-save-btn">Save Changes</button>
    `;
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const close = () => overlay.remove();

    document.getElementById('modal-close-btn')?.addEventListener('click', close);
    document.getElementById('modal-cancel-btn')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Save handler
    document.getElementById('modal-save-btn')?.addEventListener('click', () => {
      const updates = {};
      for (const section of sections) {
        for (const field of section.fields) {
          const input = document.getElementById(`edit-${field.key}`);
          if (input) {
            updates[field.key] = input.value;
          }
        }
      }
      updateHouse(project, id, updates);
      showToast(`House ${id} updated`, 'success');
      close();
      renderTable();
    });

    // Escape to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        close();
        window.removeEventListener('keydown', escHandler);
      }
    };
    window.addEventListener('keydown', escHandler);
  }

  // Initial render
  renderTable();
}

// ── Toast Notification ───────────────────────────────────
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
