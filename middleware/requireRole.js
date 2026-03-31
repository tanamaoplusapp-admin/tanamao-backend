// backend/middlewares/requireRole.js
const perms = require('../config/permissions');

function requireRole(permissionKey) {
  return (req, res, next) => {
    const role = String(req.user?.role || '').toLowerCase();
    if (!role) return res.status(401).json({ error: 'Não autenticado' });

    const allowed = perms[permissionKey] || [];
    if (role === 'superadmin' || allowed.includes(role)) return next();

    return res.status(403).json({ error: 'Acesso negado' });
  };
}

module.exports = requireRole;
