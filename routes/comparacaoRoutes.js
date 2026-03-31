// routes/comparacaoRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

/* ✅ importa APENAS a função */
const { compararOrcamento } = require('../controllers/comparacaoController');

// 🔐 Auth middleware (usa o que existir no projeto)
let verifyToken;
try {
  /* ✅ pega somente verifyToken */
  ({ verifyToken } = require('../middleware/verifyToken'));
} catch (_) {
  try {
    verifyToken = require('../middleware/authMiddleware');
  } catch (_) {
    console.warn('[comparacaoRoutes] WARNING: verifyToken/authMiddleware não encontrado. Rota sem autenticação.');
    verifyToken = (req, _res, next) => next();
  }
}

// ⏱️ Rate limit básico
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔧 Normalizador (mantido 100% igual)
function normalizeBody(req, _res, next) {
  const body = req.body || {};
  if (Array.isArray(body.items)) return next();

  if (Array.isArray(body.produtosSelecionados)) {
    req.body.items = body.produtosSelecionados.map((p) => {
      if (typeof p === 'string') {
        return { productId: p, quantity: 1 };
      }
      const id = p.productId || p._id || p.id;
      const q  = Number(p.quantity || p.qty || 1);
      return { productId: String(id || ''), quantity: Number.isFinite(q) && q > 0 ? q : 1 };
    });
  } else {
    req.body.items = [];
  }
  return next();
}

/**
 * POST /api/comparacao
 */
router.post('/', verifyToken, limiter, normalizeBody, compararOrcamento);

/**
 * Rotas de compatibilidade
 */
router.post('/comparar', verifyToken, limiter, normalizeBody, compararOrcamento);
router.post('/compara-orcamento', verifyToken, limiter, normalizeBody, compararOrcamento);

module.exports = router;
