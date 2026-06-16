/* ============================================================
   Auth Module — Client-side authentication with role-based access
   ============================================================ */

const USERS = {
  admin: { password: 'admin123', role: 'admin', name: 'Admin', label: 'Administrator' },
  sales: { password: 'sales123', role: 'sales', name: 'Sales', label: 'Sales Team' },
  site:  { password: 'site123',  role: 'site',  name: 'Site',  label: 'Site Team' },
};

const SESSION_KEY = 'duke_realty_session';

/**
 * Attempt login with given credentials
 * @returns {{ success: boolean, error?: string, user?: object }}
 */
export function login(username, password) {
  const key = username.toLowerCase().trim();
  const user = USERS[key];

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (user.password !== password) {
    return { success: false, error: 'Invalid password' };
  }

  const session = {
    username: key,
    role: user.role,
    name: user.name,
    label: user.label,
    loggedInAt: Date.now(),
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, user: session };
}

/**
 * Log out current user
 */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Get current logged-in user info, or null
 */
export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Check if a user is currently authenticated
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * Check if current user has a specific role
 */
export function hasRole(role) {
  const user = getCurrentUser();
  return user?.role === role;
}
