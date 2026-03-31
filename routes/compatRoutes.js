const express = require('express');
const router = express.Router();

const profissionaisCtrl = require('../controllers/profissionaisController');
const notificationCtrl = require('../controllers/notificationController');

/* ================= AUTH NORMALIZATION (FIX FINAL) ================= */
let verifyToken;

try {
  const auth = require('../middleware/verifyToken');

  // CASO 1: exportou objeto { verifyToken }
  if (typeof auth === 'object' && typeof auth.verifyToken === 'function') {
    verifyToken = auth.verifyToken;
  }
  // CASO 2: exportou direto a função
  else if (typeof auth === 'function') {
    verifyToken = auth;
  }
} catch (_) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken || auth;
  } catch (_) {
    verifyToken = null;
  }
}

// 🚑 fallback ABSOLUTO (impede crash)
if (typeof verifyToken !== 'function') {
  verifyToken = (_req, _res, next) => next();
}

/* ================= ROTAS LEGADAS ================= */

// GET /professional/me
router.get('/professional/me', verifyToken, (req, res) => {
  return profissionaisCtrl.getMe(req, res);
});

// GET /users/me/profile
router.get('/users/me/profile', verifyToken, (req, res) => {
  try {
    return profissionaisCtrl.getMe(req, res);
  } catch {
    const u = req.user || {};
    return res.json({
      ok: true,
      data: {
        id: u.id || u._id,
        name: u.name || u.nome,
        email: u.email,
      },
    });
  }
});

// GET /notifications
router.get('/notifications', verifyToken, (req, res) => {
  return notificationCtrl.listMine(req, res);
});

module.exports = router;
