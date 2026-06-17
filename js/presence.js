import { requireSupabase } from './supabase.js';

const HEARTBEAT_MS = 25000;
const ONLINE_POLL_MS = 10000;
const ONLINE_WINDOW_SECONDS = 90;
const SESSION_ID_KEY = 'duke_realty_presence_session_id';

let user = null;
let heartbeatId = null;
let onlinePollId = null;
const listeners = new Set();
const errorListeners = new Set();
let lastOnlineUsers = [];
let sessionId = null;

function getSessionId() {
  if (sessionId) return sessionId;

  try {
    sessionId = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      window.sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
  } catch {
    sessionId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  }

  return sessionId;
}

function currentRoute() {
  return window.location.hash || '#/dashboard';
}

async function trackPresence() {
  if (!user) return;
  try {
    await requireSupabase().rpc('track_user_presence', {
      p_session_id: getSessionId(),
      p_route: currentRoute(),
      p_visibility: document.visibilityState,
    });
  } catch (error) {
    console.error('Presence tracking failed', error);
  }
}

async function clearPresence() {
  try {
    await requireSupabase().rpc('clear_user_presence', {
      p_session_id: getSessionId(),
    });
  } catch (error) {
    console.error('Presence cleanup failed', error);
  }
}

function emitPresence() {
  listeners.forEach(listener => listener(lastOnlineUsers));
}

function emitPresenceError(error) {
  errorListeners.forEach(listener => listener(error));
}

export async function refreshOnlineUsers() {
  try {
    const { data, error } = await requireSupabase().rpc('get_online_users', {
      active_seconds: ONLINE_WINDOW_SECONDS,
    });

    if (error) throw error;

    lastOnlineUsers = (data || []).map(onlineUser => ({
      ...onlineUser,
      tab_count: Number(onlineUser.tab_count || 1),
    }));
    emitPresence();
    return { success: true, users: lastOnlineUsers };
  } catch (error) {
    console.error('Unable to load online users', error);
    emitPresenceError(error);
    return { success: false, error };
  }
}

function startOnlinePolling() {
  if (onlinePollId) return;
  refreshOnlineUsers();
  onlinePollId = window.setInterval(refreshOnlineUsers, ONLINE_POLL_MS);
}

function stopOnlinePolling() {
  if (!onlinePollId) return;
  window.clearInterval(onlinePollId);
  onlinePollId = null;
}

export function startPresence(currentUser) {
  if (!currentUser) return;

  if (user?.id === currentUser.id) {
    trackPresence();
    return;
  }

  if (user) {
    stopPresence();
  }

  user = currentUser;

  trackPresence();
  window.addEventListener('focus', trackPresence);
  window.addEventListener('hashchange', trackPresence);
  document.addEventListener('visibilitychange', trackPresence);
  heartbeatId = window.setInterval(trackPresence, HEARTBEAT_MS);
}

export async function stopPresence() {
  window.removeEventListener('focus', trackPresence);
  window.removeEventListener('hashchange', trackPresence);
  document.removeEventListener('visibilitychange', trackPresence);

  if (heartbeatId) {
    window.clearInterval(heartbeatId);
    heartbeatId = null;
  }

  const cleanupPromise = user ? clearPresence() : Promise.resolve();

  user = null;
  lastOnlineUsers = [];
  emitPresence();
  await cleanupPromise;
}

export function subscribePresence(listener, onError) {
  listeners.add(listener);
  if (onError) errorListeners.add(onError);
  listener(lastOnlineUsers);
  startOnlinePolling();

  return () => {
    listeners.delete(listener);
    if (onError) errorListeners.delete(onError);
    if (listeners.size === 0) {
      stopOnlinePolling();
    }
  };
}
