// routes/avaliacaoRoutes.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');

const {
  getAvaliacoesPorMotorista,
  createAvaliacaoGeneric,
  createAvaliacaoPedidoAlias,
} = require('../controllers/avaliacaoController');

// Middleware simples de validação
const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    return res.status(400).json({
      errors: errors.array(),
    });
  },
];

/** ===========================
 *  GETs
 *  =========================== */

// GET /api/avaliacoes/motorista/:id
router.get(
  '/motorista/:id',
  validate([
    param('id').isMongoId().withMessage('ID de motorista inválido'),
  ]),
  getAvaliacoesPorMotorista
);

/** ===========================
 *  POSTs
 *  =========================== */

// POST /api/avaliacoes
router.post(
  '/',
  verifyToken,
  validate([
    body().custom((v) => {
      if (!v || typeof v !== 'object') {
        throw new Error('Body inválido');
      }

      const keys = ['motoristaId', 'motorista', 'companyId', 'pedidoId'];
      const found = keys.filter((k) => v[k] != null);

      if (found.length !== 1) {
        throw new Error(
          'Informe exatamente um alvo: motoristaId | companyId | pedidoId'
        );
      }

      const rating = v.estrelas ?? v.rating ?? v.nota;

      if (!Number.isFinite(Number(rating))) {
        throw new Error('Informe a nota em "estrelas" (1..5)');
      }

      return true;
    }),
  ]),
  createAvaliacaoGeneric
);

// POST /api/avaliacoes/pedido
router.post(
  '/pedido',
  verifyToken,
  validate([
    body('pedidoId').isMongoId().withMessage('pedidoId inválido'),
    body('clienteId').optional().isMongoId(),
    body('estrelas').optional().isInt({ min: 1, max: 5 }),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('nota').optional().isInt({ min: 1, max: 5 }),
  ]),
  createAvaliacaoPedidoAlias
);

module.exports = router;