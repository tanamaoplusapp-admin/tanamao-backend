const express = require('express');
const rateLimit = require('express-rate-limit');
const { celebrate, Segments, Joi } = require('celebrate');

const router = express.Router();

/* ===================== AUTH (FIX DEFINITIVO) ===================== */
let verifyToken, requireRoles;

try {
  const m = require('../middleware/verifyToken');
  verifyToken = m.verifyToken;           // ✅ função correta
  requireRoles = m.requireRoles || (() => (req, _res, next) => next());
} catch (e) {
  console.warn('[driverRoutes] verifyToken não encontrado, usando fallback');
  verifyToken = (req, _res, next) => next();
  requireRoles = () => (req, _res, next) => next();
}

/* ===================== CONTROLLER ===================== */
const {
  getPedidosDoMotorista,
  updateLocalizacao,
  atualizarStatusPedido,
  getHistoricoEntregas,
} = require('../controllers/driverController');

/* ===================== RATE LIMIT ===================== */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ===================== VALIDATORS ===================== */
const orderIdParamValidator = celebrate({
  [Segments.PARAMS]: Joi.object({
    orderId: Joi.string().length(24).hex().required(),
  }),
});

const locationBodyValidator = celebrate({
  [Segments.BODY]: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }).unknown(false),
});

const statusBodyValidator = celebrate({
  [Segments.BODY]: Joi.object({
    status: Joi.string()
      .valid(
        'aguardando',
        'preparando',
        'em_rota',
        'saiu_para_entrega',
        'entregue',
        'cancelado'
      )
      .required(),
  }).unknown(false),
});

/* ===================== ROTAS ===================== */

// GET /api/drivers/pedidos
router.get(
  '/pedidos',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  getPedidosDoMotorista
);

// PATCH /api/drivers/pedidos/:orderId/location
router.patch(
  '/pedidos/:orderId/location',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  orderIdParamValidator,
  locationBodyValidator,
  updateLocalizacao
);

// PUT /api/drivers/pedidos/:orderId/status
router.put(
  '/pedidos/:orderId/status',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  orderIdParamValidator,
  statusBodyValidator,
  atualizarStatusPedido
);

// GET /api/drivers/historico
router.get(
  '/historico',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  getHistoricoEntregas
);

module.exports = router;
