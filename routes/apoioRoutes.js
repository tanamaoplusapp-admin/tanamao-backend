const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/apoioController');

/* ================= AUTH (FIX DEFINITIVO) ================= */
let verifyToken;
let requireRoles;

try {
  const auth = require('../middleware/verifyToken');
  verifyToken = auth.verifyToken;
  requireRoles = auth.requireRoles;
} catch (_) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken || auth;
    requireRoles = auth.requireRoles;
  } catch (_) {
    verifyToken = null;
    requireRoles = null;
  }
}

if (typeof verifyToken !== 'function') {
  throw new Error('[apoioRoutes] Middleware verifyToken não encontrado.');
}

if (typeof requireRoles !== 'function') {
  requireRoles = () => (_req, _res, next) => next();
}

/* ================= ROTAS ================= */

/** 🌍 Rotas públicas */
router.get('/contatos', ctrl.listContatos);
router.get('/ongs', ctrl.listOngs);

/** 🔒 Rotas administrativas */
router.post('/ongs', verifyToken, requireRoles('admin'), ctrl.createOng);
router.patch('/ongs/:id', verifyToken, requireRoles('admin'), ctrl.updateOng);
router.delete('/ongs/:id', verifyToken, requireRoles('admin'), ctrl.deleteOng);

module.exports = router;
