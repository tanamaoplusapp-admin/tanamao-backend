// utils/generateToken.js
const jwt = require('jsonwebtoken');

const normalizeRole = (r) => {
  const s = String(r || '').trim().toLowerCase();
  if (['empresa', 'company'].includes(s)) return 'empresa';
  if (['driver', 'motorista'].includes(s)) return 'motorista';
  if (['pro', 'profissional'].includes(s)) return 'profissional';
  if (['admin', 'adm'].includes(s)) return 'admin';
  if (!s || ['customer', 'cliente', 'user', 'usuario', 'usuário'].includes(s)) return 'cliente';
  return s;
};

/**
 * Gera um JWT no padrão do app.
 * Aceita um objeto user (com _id/id/role/porteEmpresa/isVerified) ou apenas um id string.
 *
 * @param {object|string} userOrId - Documento do usuário/empresa ou apenas o id.
 * @param {object} [extraClaims]   - Claims extras para incluir no token (evita sobrescrever reservadas).
 * @param {object} [options]       - Opções do jwt.sign (ex.: { expiresIn: '7d' }).
 * @returns {string} token JWT
 */
function generateToken(userOrId, extraClaims = {}, options = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim() === '') {
    throw new Error('JWT_SECRET ausente no ambiente.');
  }

  let id = null;
  let role, porteEmpresa, isVerified;

  if (typeof userOrId === 'string') {
    id = userOrId;
  } else if (userOrId && typeof userOrId === 'object') {
    id = String(userOrId._id || userOrId.id || '');
    role = normalizeRole(userOrId.role || userOrId.tipo);
    porteEmpresa = userOrId.porteEmpresa;
    isVerified = userOrId.isVerified;
  }

  if (!id) {
    throw new Error('generateToken: id inválido ou não informado.');
  }

  // payload padrão do app
  const basePayload = {
    sub: id,
    userId: id,
    role: role || 'cliente',
    tipo: role || 'cliente', // compat com código legado
    porteEmpresa: porteEmpresa,
    isVerified: typeof isVerified === 'boolean' ? isVerified : undefined,
  };

  // não permitir que claims reservadas sejam sobrescritas por engano
  const reserved = new Set(['sub', 'userId', 'role', 'tipo', 'porteEmpresa', 'isVerified', 'exp', 'iat', 'nbf']);
  const safeExtras = Object.fromEntries(
    Object.entries(extraClaims || {}).filter(([k]) => !reserved.has(k))
  );

  const payload = { ...basePayload, ...safeExtras };

  const jwtOptions = {
    expiresIn: options.expiresIn || '7d',
    ...options,
  };

  return jwt.sign(payload, secret, jwtOptions);
}

module.exports = generateToken;
