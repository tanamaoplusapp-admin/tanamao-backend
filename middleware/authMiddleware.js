// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

// ⚠️ ATENÇÃO AO CASE no Linux/Render:
const User    = require('../models/User');       // clientes/profissionais/motoristas
const Empresa = require('../models/Empresa');    // empresas

function pick(obj = {}, keys = []) {
  return keys.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});
}

function normalizeRole(v) {
  const r = String(v || '').toLowerCase().trim();
  if (['empresa', 'company'].includes(r)) return 'empresa';
  if (['motorista', 'driver'].includes(r)) return 'motorista';
  if (['profissional', 'professional'].includes(r)) return 'profissional';
  if (['admin', 'administrator'].includes(r)) return 'admin';
  return r || 'cliente';
}

async function authMiddleware(req, res, next) {
  try {
    const header =
      req.headers.authorization ||
      req.headers['x-access-token'] ||
      req.headers['x-auth-token'];

    const cookieToken = req.cookies?.token;
    const queryToken =
      process.env.NODE_ENV !== 'production' ? (req.query?.token || null) : null;

    if (!header && !cookieToken && !queryToken) {
      return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    const raw = header
      ? (header.includes(' ') ? header.split(' ')[1] : header)
      : (cookieToken || queryToken);

    if (!raw) {
      return res.status(401).json({ error: 'Acesso negado. Token malformado.' });
    }

    const decoded = jwt.verify(raw, process.env.JWT_SECRET);

    const id = String(decoded.sub || decoded.userId || decoded.id || '');
    if (!id) {
      return res.status(401).json({ error: 'Token sem id de usuário.' });
    }

    let finalRole = normalizeRole(decoded.role || decoded.tipo);

    let baseUser = null;
    let companyId = null;

    if (finalRole === 'empresa') {
      const emp = await Empresa.findById(id).lean();
      if (emp) {
        baseUser = {
          id,
          _id: id,
          role: 'empresa',
          tipo: 'empresa',
          companyId: id,
          empresaId: id,
          ...pick(emp, ['nome', 'email', 'porteEmpresa', 'isVerified']),
        };
      } else {
        const u = await User.findById(id).lean();
        if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });

        finalRole = normalizeRole(u.role || 'cliente');
        companyId = u.companyId || u.empresaId || null;

        baseUser = {
          id,
          _id: id,
          role: finalRole,
          tipo: finalRole,
          companyId,
          empresaId: companyId,
          ...pick(u, ['name', 'email', 'isVerified']),
        };
      }
    } else {
      const u = await User.findById(id).lean();
      if (u) {
        finalRole = normalizeRole(u.role || finalRole || 'cliente');
        companyId = u.companyId || u.empresaId || null;

        baseUser = {
          id,
          _id: id,
          role: finalRole,
          tipo: finalRole,
          companyId,
          empresaId: companyId,
          ...pick(u, ['name', 'email', 'isVerified']),
        };
      } else {
        const emp = await Empresa.findById(id).lean();
        if (!emp) return res.status(404).json({ error: 'Usuário não encontrado.' });

        finalRole = 'empresa';

        baseUser = {
          id,
          _id: id,
          role: 'empresa',
          tipo: 'empresa',
          companyId: id,
          empresaId: id,
          ...pick(emp, ['nome', 'email', 'porteEmpresa', 'isVerified']),
        };
      }
    }

    // 🔐 PADRÃO FINAL (sem quebrar compatibilidade)
    req.user = baseUser;
    req.userId = id;
    req.userRole = finalRole;
    req.auth = { token: raw, decoded };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    console.error('❌ authMiddleware error:', err);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

const requireRoles = (...roles) => {
  const allowed = roles.map((v) => String(v || '').toLowerCase().trim());
  return (req, res, next) => {
    const role = String(req.user?.role || req.user?.tipo || '').toLowerCase().trim();
    if (!role) return res.status(403).json({ error: 'Forbidden' });
    return allowed.includes(role) ? next() : res.status(403).json({ error: 'Forbidden' });
  };
};

const requireVerified = (req, res, next) => {
  const isVerified = req.user?.isVerified;
  const role = String(req.user?.role || req.user?.tipo || '').toLowerCase().trim();
  if (isVerified === undefined && role === 'empresa') return next(); // compat
  if (isVerified) return next();
  return res.status(403).json({ error: 'Conta não verificada.' });
};

module.exports = authMiddleware;
module.exports.requireRoles = requireRoles;
module.exports.requireVerified = requireVerified;
