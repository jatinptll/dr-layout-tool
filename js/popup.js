/* ============================================================
   Popup Module — Role-aware house detail popup
   Shows different fields based on the logged-in user's role.
   Admin can inline-edit fields.
   ============================================================ */

import { getHouseForRole, getEditableFields, updateHouse } from './data.js';
import { getCurrentUser } from './auth.js';

let activePopup = null;
let activeOverlay = null;

/**
 * Show the house detail popup
 * @param {string} project - 'antonia' or 'aranya'
 * @param {number} id - House number
 * @param {Function} [onUpdate] - Called after data is saved
 */
export function showHousePopup(project, id, onUpdate) {
  closePopup();

  const user = getCurrentUser();
  if (!user) return;

  const role = user.role;
  const house = getHouseForRole(project, id, role);
  if (!house) return;

  const sections = getEditableFields(role);
  const isAdmin = role === 'admin';

  // Overlay
  activeOverlay = document.createElement('div');
  activeOverlay.className = 'popup-overlay';
  activeOverlay.addEventListener('click', closePopup);
  document.body.appendChild(activeOverlay);

  // Popup
  activePopup = document.createElement('div');
  activePopup.className = 'house-popup';
  activePopup.id = 'house-popup';

  // Position on desktop: center of viewport
  if (window.innerWidth > 768) {
    activePopup.style.top = '50%';
    activePopup.style.left = '50%';
    activePopup.style.transform = 'translate(-50%, -50%)';
  }

  // Header
  const statusClass = house.status === 'booked' ? 'booked' : 'available';
  const statusLabel = house.status === 'booked' ? 'Booked' : 'Available';

  const header = document.createElement('div');
  header.className = 'popup-header';
  header.innerHTML = `
    <h3>
      <span style="color:var(--accent)">House ${id}</span>
      <span class="status-badge ${statusClass}">${statusLabel}</span>
    </h3>
    <button class="popup-close" id="popup-close-btn" aria-label="Close popup">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;
  activePopup.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'popup-body';
  body.id = 'popup-body';

  for (const section of sections) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'popup-section';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'popup-section-title';
    sectionTitle.textContent = section.section;
    sectionEl.appendChild(sectionTitle);

    for (const field of section.fields) {
      const fieldEl = document.createElement('div');
      fieldEl.className = 'popup-field';

      const label = document.createElement('span');
      label.className = 'popup-field-label';
      label.textContent = field.label;

      const value = document.createElement('span');
      const rawVal = house[field.key];
      const displayVal = rawVal || '—';

      if (isAdmin && !field.readonly) {
        // Editable field
        value.className = 'popup-field-value editable';
        value.textContent = displayVal;
        if (!rawVal) value.classList.add('empty');
        value.dataset.key = field.key;
        value.dataset.fieldType = field.type;
        value.dataset.options = field.options ? JSON.stringify(field.options) : '';

        value.addEventListener('click', () => {
          startInlineEdit(value, project, id, field, onUpdate);
        });
      } else {
        // Read-only field
        value.className = `popup-field-value ${!rawVal ? 'empty' : ''}`;
        value.textContent = displayVal;
      }

      fieldEl.appendChild(label);
      fieldEl.appendChild(value);
      sectionEl.appendChild(fieldEl);
    }

    body.appendChild(sectionEl);
  }

  activePopup.appendChild(body);
  document.body.appendChild(activePopup);

  // Close button
  document.getElementById('popup-close-btn')?.addEventListener('click', closePopup);

  // Escape to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closePopup();
      window.removeEventListener('keydown', escHandler);
    }
  };
  window.addEventListener('keydown', escHandler);
}

/**
 * Start inline editing a field value
 */
function startInlineEdit(valueEl, project, id, field, onUpdate) {
  // Prevent double-edit
  if (valueEl.querySelector('input, select, textarea')) return;

  const currentVal = valueEl.dataset.key;
  const house = getHouseForRole(project, id, 'admin');
  const rawVal = house?.[field.key] || '';

  const editContainer = document.createElement('div');
  editContainer.className = 'popup-inline-edit';

  let input;

  if (field.type === 'select') {
    input = document.createElement('select');
    input.className = 'form-select';
    input.style.width = '140px';
    input.style.padding = '3px 6px';
    input.style.fontSize = '0.85rem';
    for (const opt of (field.options || [])) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt || '(none)';
      if (opt === rawVal) option.selected = true;
      input.appendChild(option);
    }
  } else if (field.type === 'textarea') {
    input = document.createElement('input');
    input.type = 'text';
    input.value = rawVal;
    input.placeholder = field.label;
  } else if (field.type === 'date') {
    input = document.createElement('input');
    input.type = 'date';
    input.value = rawVal;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.value = rawVal;
    input.placeholder = field.label;
  }

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '✓';
  saveBtn.title = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕';
  cancelBtn.title = 'Cancel';
  cancelBtn.style.background = 'var(--bg-surface)';
  cancelBtn.style.color = 'var(--text-secondary)';

  editContainer.appendChild(input);
  editContainer.appendChild(saveBtn);
  editContainer.appendChild(cancelBtn);

  // Replace value display with edit controls
  valueEl.textContent = '';
  valueEl.classList.remove('editable');
  valueEl.appendChild(editContainer);

  input.focus();

  const save = () => {
    const newVal = input.value;
    updateHouse(project, id, { [field.key]: newVal });
    valueEl.textContent = newVal || '—';
    valueEl.classList.add('editable');
    valueEl.classList.toggle('empty', !newVal);
    if (onUpdate) onUpdate(project, id);

    // If status changed, refresh the popup
    if (field.key === 'status') {
      const badge = document.querySelector('.popup-header .status-badge');
      if (badge) {
        badge.className = `status-badge ${newVal}`;
        badge.textContent = newVal === 'booked' ? 'Booked' : 'Available';
      }
    }
  };

  const cancel = () => {
    valueEl.textContent = rawVal || '—';
    valueEl.classList.add('editable');
    valueEl.classList.toggle('empty', !rawVal);
  };

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    save();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancel();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  });
}

/**
 * Close the popup
 */
export function closePopup() {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}
