/* ============================================================
   Data Module — Supabase-backed house data with realtime cache
   ============================================================ */

import { requireSupabase } from './supabase.js';

const PROJECTS = {
  antonia: 34,
  aranya: 68,
};

const COLUMN_TO_FIELD = {
  house_number: 'id',
  plot_size: 'plotSize',
  customer_name: 'customerName',
  customer_phone: 'customerPhone',
  booking_date: 'bookingDate',
  payment_status: 'paymentStatus',
  construction_stage: 'constructionStage',
  pending_work: 'pendingWork',
  material_status: 'materialStatus',
  contractor_name: 'contractorName',
  site_notes: 'siteNotes',
  target_date: 'targetDate',
  cost_price: 'costPrice',
  profit_margin: 'profitMargin',
  internal_notes: 'internalNotes',
};

const FIELD_TO_COLUMN = Object.fromEntries(
  Object.entries(COLUMN_TO_FIELD).map(([column, field]) => [field, column]),
);

let cache = generateSeedData();
let lastLoadPromise = null;

function createDefaultHouse(project, id) {
  return {
    id,
    project,
    plotSize: '',
    facing: '',
    type: '',
    status: 'available',
    price: '',
    customerName: '',
    customerPhone: '',
    bookingDate: '',
    paymentStatus: '',
    constructionStage: '',
    pendingWork: '',
    materialStatus: '',
    contractorName: '',
    siteNotes: '',
    targetDate: '',
    costPrice: '',
    profitMargin: '',
    internalNotes: '',
  };
}

function generateSeedData() {
  const data = { antonia: {}, aranya: {} };
  for (const [project, count] of Object.entries(PROJECTS)) {
    for (let id = 1; id <= count; id += 1) {
      data[project][id] = createDefaultHouse(project, id);
    }
  }
  return data;
}

function rowToHouse(row) {
  const house = createDefaultHouse(row.project, Number(row.house_number));

  for (const [key, value] of Object.entries(row)) {
    if (key === 'project') {
      house.project = value;
    } else if (key === 'house_number') {
      house.id = Number(value);
    } else {
      const field = COLUMN_TO_FIELD[key] || key;
      if (field in house) house[field] = value ?? '';
    }
  }

  return house;
}

function houseToDbPatch(house) {
  const patch = {};
  for (const [field, value] of Object.entries(house)) {
    if (field === 'id' || field === 'project') continue;
    const column = FIELD_TO_COLUMN[field] || field;
    patch[column] = value ?? '';
  }
  return patch;
}

function applyHouseToCache(house) {
  if (!cache[house.project]) cache[house.project] = {};
  cache[house.project][house.id] = { ...createDefaultHouse(house.project, house.id), ...house };
}

function applyRows(rows) {
  const next = generateSeedData();
  for (const row of rows || []) {
    const house = rowToHouse(row);
    if (!next[house.project]) next[house.project] = {};
    next[house.project][house.id] = house;
  }
  cache = next;
}

export async function initData() {
  if (!lastLoadPromise) {
    lastLoadPromise = loadHouses().finally(() => {
      lastLoadPromise = null;
    });
  }
  return lastLoadPromise;
}

export async function loadHouses() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_houses_for_current_user');
  if (error) {
    throw new Error(error.message || 'Unable to load house data from Supabase.');
  }
  applyRows(data);
  return cache;
}

export function getHouses(project) {
  return cache[project] || {};
}

export function getHouse(project, id) {
  const houses = getHouses(project);
  return houses[id] || null;
}

export function getHousesList(project) {
  const houses = getHouses(project);
  return Object.values(houses).sort((a, b) => a.id - b.id);
}

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

export async function updateHouse(project, id, updates) {
  const client = requireSupabase();
  const payload = houseToDbPatch(updates);

  const { data, error } = await client.rpc('update_house', {
    h_project: project,
    h_house_number: Number(id),
    h_updates: payload,
  });

  if (error) {
    throw new Error(error.message || `Unable to update house ${id}.`);
  }

  const updated = Array.isArray(data) ? data[0] : data;
  if (updated) {
    const house = rowToHouse(updated);
    applyHouseToCache(house);
    return house;
  }

  await loadHouses();
  return getHouse(project, id);
}

export function exportData() {
  const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `duke-realty-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.antonia || !data.aranya) {
      throw new Error('Invalid data format');
    }

    for (const [project, houses] of Object.entries(data)) {
      for (const [id, house] of Object.entries(houses)) {
        await updateHouse(project, Number(id), house);
      }
    }

    await loadHouses();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function resetData() {
  const defaults = generateSeedData();
  for (const [project, houses] of Object.entries(defaults)) {
    for (const [id, house] of Object.entries(houses)) {
      await updateHouse(project, Number(id), house);
    }
  }
  cache = defaults;
}

export function getProjectStats(project) {
  const houses = getHousesList(project);
  const total = houses.length;
  const available = houses.filter(h => h.status === 'available').length;
  const booked = houses.filter(h => h.status === 'booked').length;
  return { total, available, booked };
}

export function subscribeToHouseChanges(onChange) {
  const client = requireSupabase();
  let refreshTimer = null;

  const refresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(async () => {
      try {
        await loadHouses();
        onChange?.();
      } catch (error) {
        console.error('Realtime refresh failed', error);
      }
    }, 150);
  };

  const channel = client
    .channel('duke-realty-house-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'house_change_events' },
      refresh,
    )
    .subscribe();

  return () => {
    window.clearTimeout(refreshTimer);
    client.removeChannel(channel);
  };
}
