'use strict';

const jwt = require('jsonwebtoken');

let User = null;
try { User = require('../models/user'); } catch (_) {}

let Empresa = null;
try { Empresa = require('../models/Empresa'); } catch (_) {
  try { Empresa = require('../models/company'); } catch (_) {}
}

let Profissional = null;
try { Profissional = require('../models/Profissional'); } catch (_) {}

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'dev_secret' : null);

/* =========================
   HELPERS
========================= */

function normalizeRole(role) {
  const r = String(role || '').toLowerCase();

  if (['admin','adm','administrator'].includes(r)) return 'admin';
  if (['empresa','company'].includes(r)) return 'empresa';
  if (['motorista','driver'].includes(r)) return 'motorista';
  if (['profissional','prof','pro'].includes(r)) return 'profissional';

  return 'cliente';
}

function extractToken(req){

  const auth =
    req.headers.authorization ||
    req.headers.Authorization ||
    req.headers['x-access-token'] ||
    '';

  if (typeof auth === 'string' && auth.startsWith('Bearer '))
    return auth.replace('Bearer ','').trim();

  if (req.cookies?.token)
    return req.cookies.token;

  return null;
}

/* =========================
   MIDDLEWARE
========================= */

async function verifyToken(req,res,next){

  try{

    const token = extractToken(req);

    if (!token)
      return res.status(401).json({ error:'Token não fornecido' });

    if (!JWT_SECRET)
      return res.status(500).json({ error:'JWT_SECRET não configurado' });

    const decoded = jwt.verify(token,JWT_SECRET);

    /* 🔒 aceita TODOS formatos de token */

    const userId =
      decoded.sub ||
      decoded.userId ||
      decoded.id ||
      decoded._id;

    if (!userId)
      return res.status(401).json({ error:'Token inválido (sem id)' });

    const roleFromToken =
      normalizeRole(decoded.role || decoded.tipo);

    let user = null;

    /* ==================================
       EMPRESA
    ================================== */

    if (roleFromToken === 'empresa' && Empresa){

      const empresa = await Empresa.findById(userId).lean();

      if (empresa){

        req.user = {
          _id: empresa._id,
          id: empresa._id.toString(),
          name: empresa.nome,
          email: empresa.email,
          role: 'empresa',
          tipo: 'empresa',
          companyId: empresa._id,
          isVerified: !!empresa.isVerified
        };

        req.userId = empresa._id;
        req.companyId = empresa._id;
        req.auth = decoded;

        return next();
      }
    }

    /* ==================================
       PROFISSIONAL (MODEL PRÓPRIO)
    ================================== */
if (roleFromToken === 'profissional' && Profissional) {

  const prof = await Profissional.findOne({
    $or: [
      { _id: userId },
      { userId: userId }
    ]
  }).lean();

  if (prof) {

    const userIdFinal = prof.userId || prof._id;

    req.user = {
      _id: userIdFinal,
      id: userIdFinal.toString(),
      name: prof.nome || prof.name,
      email: prof.email,
      role: 'profissional',
      tipo: 'profissional',
      isVerified: !!prof.isVerified
    };

    req.userId = userIdFinal;
    req.auth = decoded;

    return next();
  }
}
    /* ==================================
       USER (fallback universal)
    ================================== */

    if (User){

      user = await User.findById(userId).lean();

      if (!user)
        return res.status(401).json({ error:'Usuário não encontrado' });

      const role =
        normalizeRole(user.role || roleFromToken);

      req.user = {
        _id: user._id,
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role,
        tipo: role,
        companyId: user.companyId || user.empresaId || null,
        isVerified: !!user.isVerified
      };

      req.userId = user._id;
      req.auth = decoded;

      return next();
    }

    return res.status(500).json({
      error:'Nenhum modelo disponível para autenticação'
    });

  }
  catch(err){

    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error:'Token expirado' });

    if (err.name === 'JsonWebTokenError')
      return res.status(401).json({ error:'Token inválido' });

    console.error('[verifyToken] erro:',err);

    return res.status(401).json({ error:'Token inválido' });

  }

}

/* =========================
   ROLE GUARD
========================= */

const requireRoles = (...roles)=>{

  const allowed =
    roles.map(normalizeRole);

  return (req,res,next)=>{

    const role =
      normalizeRole(req.user?.role || req.user?.tipo);

    if (!allowed.includes(role))
      return res.status(403).json({ error:'Permissão negada' });

    next();

  }

};

/* =========================
   VERIFIED GUARD
========================= */
const requireVerified = (req,res,next)=>{

// permitir compra de créditos mesmo não verificado
if(req.originalUrl.includes('/payment/credits')){
return next()
}

if (!req.user?.isVerified){
return res.status(403).json({
error:'Conta não verificada'
})
}

next();
};
/* EXPORTS */

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.requireRoles = requireRoles;
module.exports.requireVerified = requireVerified;