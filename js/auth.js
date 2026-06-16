/* ============================================================
   Auth Module — Supabase authentication with role profiles
   ============================================================ */

import { getSupabaseConfigError, isSupabaseConfigured, requireSupabase } from './supabase.js';

let currentUser = null;

function formatAuthError(message) {
  if (!message) return 'Unable to sign in.';
  if (message.toLowerCase().includes('invalid login')) {
    return 'Invalid username, email, or password.';
  }
  return message;
}

function normalizeIdentifier(identifier) {
  return identifier.trim().toLowerCase();
}

async function resolveLoginEmail(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;

  const client = requireSupabase();
  const { data, error } = await client.rpc('resolve_login_email', {
    login_identifier: normalized,
  });

  if (error || !data) return normalized;
  return data;
}

async function loadProfile(user) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_profiles')
    .select('username,role,name,label')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    throw new Error('This account has no Duke Realty role profile. Ask an admin to add it in Supabase.');
  }

  currentUser = {
    id: user.id,
    email: user.email,
    username: data.username || user.email,
    role: data.role,
    name: data.name || user.email,
    label: data.label || data.role,
    loggedInAt: Date.now(),
  };

  return currentUser;
}

export async function initAuth() {
  if (!isSupabaseConfigured) {
    currentUser = null;
    return null;
  }

  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.user) {
    currentUser = null;
    return null;
  }

  try {
    return await loadProfile(data.session.user);
  } catch {
    await client.auth.signOut();
    currentUser = null;
    return null;
  }
}

/**
 * Attempt login with Supabase email-or-username/password credentials.
 * @returns {Promise<{ success: boolean, error?: string, user?: object }>}
 */
export async function login(identifier, password) {
  if (!isSupabaseConfigured) {
    return { success: false, error: getSupabaseConfigError() };
  }

  const client = requireSupabase();
  const email = await resolveLoginEmail(identifier);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { success: false, error: formatAuthError(error?.message) };
  }

  try {
    const user = await loadProfile(data.user);
    return { success: true, user };
  } catch (profileError) {
    await client.auth.signOut();
    currentUser = null;
    return { success: false, error: profileError.message };
  }
}

export async function logout() {
  if (isSupabaseConfigured) {
    await requireSupabase().auth.signOut();
  }
  currentUser = null;
}

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return currentUser !== null;
}

export function hasRole(role) {
  return currentUser?.role === role;
}
