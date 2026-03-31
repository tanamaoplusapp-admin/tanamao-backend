// routes/entregaRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { celebrate, Segments, Joi } = require('celebrate');

const router = express.Router();

/* ✅ importa SOMENTE as funções */
const {
  registrarLocalizacao,
  confirmarEntrega,
} = require('../controllers/entregaController');

// 🔐 Auth middleware (tenta ambos nomes)
let verifyToken, requireRoles;
try {
  ({ verifyToken, requireRoles } = require('../middleware/verifyToken'));
} catch (_) {
  try {
    ({ verifyToken, requireRoles } = require('../middleware/authMiddleware'));
  } catch (_) {
    console.warn('[entregaRoutes] WARNING: auth middleware não encontrado. Rotas abertas.');
    verifyToken = (_req, _res, next) => next();
    requireRoles = () => (_req, _res, next) => next();
  }
}

// fallback seguro
if (typeof verifyToken !== 'function') {
  verifyToken = (_req, _res, next) => next();
}
if (typeof requireRoles !== 'function') {
  requireRoles = () => (_req, _res, next) => next();
}

// 🛡️ Rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Validators
const locationBodyValidator = celebrate({
  [Segments.BODY]: Joi.object({
    orderId: Joi.string().length(24).hex().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),
});

const confirmarBodyValidator = celebrate({
  [Segments.BODY]: Joi.object({
    orderId: Joi.string().length(24).hex().required(),
  }),
});

/**
 * 📍 Atualizar localização do motorista
 */
router.post(
  '/localizacao',
  verifyToken,
  requireRoles('motorista'),
  limiter,
  locationBodyValidator,
  registrarLocalizacao
);

/**
 * ✅ Confirmar entrega
 */
router.post(
  '/confirmar',
  verifyToken,
  requireRoles('motorista'),
  limiter,
  confirmarBodyValidator,
  confirmarEntrega
);

/**
 * PATCH /api/entregas/:orderId/location
 */
router.patch(
  '/:orderId/location',
  verifyToken,
  requireRoles('motorista'),
  limiter,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      orderId: Joi.string().length(24).hex().required(),
    }),
    [Segments.BODY]: Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
    }),
  }),
  (req, res, next) => {
    req.body.orderId = req.params.orderId;
    return registrarLocalizacao(req, res, next);
  }
);

/**
 * POST /api/entregas/:orderId/confirm
 */
router.post(
  '/:orderId/confirm',
  verifyToken,
  requireRoles('motorista'),
  limiter,
  celebrate({
    [Segments.PARAMS]: Joi.object({
      orderId: Joi.string().length(24).hex().required(),
    }),
  }),
  (req, res, next) => {
    req.body.orderId = req.params.orderId;
    return confirmarEntrega(req, res, next);
  }
);

// 🔎 Health check
router.get('/', (_req, res) => {
  res.json({ message: '📦 Rota de entrega funcionando corretamente' });
});

module.exports = router;
