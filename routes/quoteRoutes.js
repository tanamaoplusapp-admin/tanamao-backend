// routes/quoteRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { compararOrcamento } = require('../controllers/comparacaoController');

const router = express.Router();

/* Auth middleware (tenta ambos nomes; se não existir, segue sem bloquear) */
let verifyToken;
try {
  // ✅ pega APENAS a função verifyToken
  ({ verifyToken } = require('../middleware/verifyToken'));
} catch (_) {
  try {
    verifyToken = require('../middleware/authMiddleware');
  } catch {
    console.warn('[quoteRoutes] WARNING: verifyToken/authMiddleware não encontrado. Rotas sem autenticação.');
    verifyToken = (req, _res, next) => next();
  }
}

/* Rate limit básico para evitar spam */
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,             // 60 req/min por IP
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ✅ Rota principal recomendada:
 *     POST /api/orcamentos
 */
router.post('/', verifyToken, limiter, compararOrcamento);

/**
 * ♻️ Compat legada:
 *     POST /api/orcamentos/compara-orcamento
 */
router.post('/compara-orcamento', verifyToken, limiter, compararOrcamento);

module.exports = router;
