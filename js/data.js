/* ============================================================
   Data Module — House data management with localStorage
   ============================================================ */

const STORAGE_KEY = 'duke_realty_houses';

// ---------- Schema ----------

function createDefaultHouse(project, id) {
  return {
    id,
    project,
    // Common
    plotSize: '',
    facing: '',
    type: '',
    // Sales
    status: 'available', // 'available' or 'booked'
    price: '',
    customerName: '',
    customerPhone: '',
    bookingDate: '',
    paymentStatus: '',
    // Site / Construction
    constructionStage: '',
    pendingWork: '',
    materialStatus: '',
    contractorName: '',
    siteNotes: '',
    targetDate: '',
    // Admin only
    costPrice: '',
    profitMargin: '',
    internalNotes: '',
  };
}

// ---------- Seed Data ----------

function generateSeedData() {
  const data = { antonia: {}, aranya: {} };

  // Antonia: 34 houses
  for (let i = 1; i <= 34; i++) {
    data.antonia[i] = createDefaultHouse('antonia', i);
  }

  // Aranya: 68 houses
  for (let i = 1; i <= 68; i++) {
    data.aranya[i] = createDefaultHouse('aranya', i);
  }

  return data;
}

// ---------- Init ----------

export function initData() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(generateSeedData()));
  }
}

// ---------- Read ----------

function getAllData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || generateSeedData();
  } catch {
    return generateSeedData();
  }
}

export function getHouses(project) {
  const data = getAllData();
  return data[project] || {};
}

export function getHouse(project, id) {
  const houses = getHouses(project);
  return houses[id] || null;
}

export function getHousesList(project) {
  const houses = getHouses(project);
  return Object.values(houses).sort((a, b) => a.id - b.id);
}

// ---------- Role-filtered Read ----------

const COMMON_FIELDS = ['id', 'project', 'plotSize', 'facing', 'type', 'status'];
const SALES_FIELDS = [...COMMON_FIELDS, 'price', 'customerName', 'customerPhone', 'bookingDate', 'paymentStatus'];
const SITE_FIELDS = [...COMMON_FIELDS, 'constructionStage', 'pendingWork', 'materialStatus', 'contractorName', 'siteNotes', 'targetDate'];

export function getHouseForRole(project, id, role) {
  const house = getHouse(project, id);
  if (!house) return null;

  if (role === 'admin') return { ...house };

  const allowedFields = role === 'sales' ? SALES_FIELDS : SITE_FIELDS;
  const filtered = {};
  for (const field of allowedFields) {
    filtered[field] = house[field];
  }
  return filtered;
}

export function getEditableFields(role) {
  if (role === 'admin') {
    return [
      { section: 'General', fields: [
        { key: 'plotSize', label: 'Plot Size', type: 'text' },
        { key: 'facing', label: 'Facing', type: 'select', options: ['', 'North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'] },
        { key: 'type', label: 'Type', type: 'select', options: ['', '2BHK', '3BHK', '4BHK', 'Villa', 'Duplex', 'Plot'] },
        { key: 'status', label: 'Status', type: 'select', options: ['available', 'booked'] },
      ]},
      { section: 'Sales', fields: [
        { key: 'price', label: 'Price', type: 'text' },
        { key: 'customerName', label: 'Customer Name', type: 'text' },
        { key: 'customerPhone', label: 'Customer Phone', type: 'text' },
        { key: 'bookingDate', label: 'Booking Date', type: 'date' },
        { key: 'paymentStatus', label: 'Payment Status', type: 'select', options: ['', 'Pending', 'Partial', 'Complete'] },
      ]},
      { section: 'Construction', fields: [
        { key: 'constructionStage', label: 'Stage', type: 'select', options: ['', 'Not Started', 'Foundation', 'Plinth', 'Superstructure', 'Roofing', 'Finishing', 'Complete'] },
        { key: 'pendingWork', label: 'Pending Work', type: 'textarea' },
        { key: 'materialStatus', label: 'Material Status', type: 'text' },
        { key: 'contractorName', label: 'Contractor', type: 'text' },
        { key: 'siteNotes', label: 'Site Notes', type: 'textarea' },
        { key: 'targetDate', label: 'Target Date', type: 'date' },
      ]},
      { section: 'Internal', fields: [
        { key: 'costPrice', label: 'Cost Price', type: 'text' },
        { key: 'profitMargin', label: 'Profit Margin', type: 'text' },
        { key: 'internalNotes', label: 'Internal Notes', type: 'textarea' },
      ]},
    ];
  }

  if (role === 'sales') {
    return [
      { section: 'General', fields: [
        { key: 'plotSize', label: 'Plot Size', type: 'text', readonly: true },
        { key: 'facing', label: 'Facing', type: 'text', readonly: true },
        { key: 'type', label: 'Type', type: 'text', readonly: true },
        { key: 'status', label: 'Status', type: 'text', readonly: true },
      ]},
      { section: 'Sales', fields: [
        { key: 'price', label: 'Price', type: 'text', readonly: true },
        { key: 'customerName', label: 'Customer', type: 'text', readonly: true },
        { key: 'customerPhone', label: 'Phone', type: 'text', readonly: true },
        { key: 'bookingDate', label: 'Booking Date', type: 'text', readonly: true },
        { key: 'paymentStatus', label: 'Payment', type: 'text', readonly: true },
      ]},
    ];
  }

  // site role
  return [
    { section: 'General', fields: [
      { key: 'plotSize', label: 'Plot Size', type: 'text', readonly: true },
      { key: 'facing', label: 'Facing', type: 'text', readonly: true },
      { key: 'type', label: 'Type', type: 'text', readonly: true },
      { key: 'status', label: 'Status', type: 'text', readonly: true },
    ]},
    { section: 'Construction', fields: [
      { key: 'constructionStage', label: 'Stage', type: 'text', readonly: true },
      { key: 'pendingWork', label: 'Pending Work', type: 'text', readonly: true },
      { key: 'materialStatus', label: 'Material', type: 'text', readonly: true },
      { key: 'contractorName', label: 'Contractor', type: 'text', readonly: true },
      { key: 'siteNotes', label: 'Site Notes', type: 'text', readonly: true },
      { key: 'targetDate', label: 'Target Date', type: 'text', readonly: true },
    ]},
  ];
}

// ---------- Write ----------

export function updateHouse(project, id, updates) {
  const data = getAllData();
  if (!data[project]) data[project] = {};
  if (!data[project][id]) data[project][id] = createDefaultHouse(project, id);

  Object.assign(data[project][id], updates);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data[project][id];
}

// ---------- Export / Import ----------

export function exportData() {
  const data = getAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `duke-realty-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.antonia || !data.aranya) {
      throw new Error('Invalid data format');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export function resetData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(generateSeedData()));
}

// ---------- Stats ----------

export function getProjectStats(project) {
  const houses = getHousesList(project);
  const total = houses.length;
  const available = houses.filter(h => h.status === 'available').length;
  const booked = houses.filter(h => h.status === 'booked').length;
  return { total, available, booked };
}
