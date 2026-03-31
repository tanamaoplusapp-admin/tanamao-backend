// backend/config/permissions.js
module.exports = {
  // recurso: [roles permitidos]
  'finance:read': ['superadmin', 'financeiro', 'admin-ops'],
  'finance:reconcile': ['superadmin', 'financeiro'],
  'support:read': ['superadmin', 'suporte', 'admin-ops'],
  'support:reply': ['superadmin', 'suporte', 'admin-ops'],
  'bugs:read': ['superadmin', 'cto', 'admin-ops', 'suporte'],
  'bugs:update': ['superadmin', 'cto', 'admin-ops'],
  'partners:read': ['superadmin', 'bd'],
  'rbac:manage': ['superadmin'],
  'feature:toggle': ['superadmin', 'cto'],
  'audit:read': ['superadmin', 'admin-ops', 'cto'],
};
