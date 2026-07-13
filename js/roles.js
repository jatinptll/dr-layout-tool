const ADMIN_ROLES = new Set(['admin', 'super_admin']);

function resolveRole(roleOrUser) {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role;
  return String(role || '').trim().toLowerCase();
}

export function hasAdminAccess(roleOrUser) {
  return ADMIN_ROLES.has(resolveRole(roleOrUser));
}

export function hasSuperAdminAccess(roleOrUser) {
  return resolveRole(roleOrUser) === 'super_admin';
}
