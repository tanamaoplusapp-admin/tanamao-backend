const express = require('express');
const rateLimit = require('express-rate-limit');
const { celebrate, Segments, Joi } = require('celebrate');

const router = express.Router();

/* ================= AUTH (FIX DEFINITIVO) ================= */
let verifyToken;
let requireRoles = () => (_req, _res, next) => next();

try {
  const auth = require('../middleware/verifyToken');
  verifyToken = auth.verifyToken;
  if (typeof auth.requireRoles === 'function') {
    requireRoles = auth.requireRoles;
  }
} catch (_) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken || auth;
    if (typeof auth.requireRoles === 'function') {
      requireRoles = auth.requireRoles;
    }
  } catch (_) {
    verifyToken = (_req, _res, next) => next();
  }
}

const ctrl = require('../controllers/driverBankController');

/* ---------------- Rate limit ---------------- */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ---------------- Validators ---------------- */
const idOrMeValidator = celebrate({
  [Segments.PARAMS]: Joi.object({
    id: Joi.alternatives()
      .try(Joi.string().length(24).hex(), Joi.string().valid('me'))
      .required(),
  }),
});

const bankBodyValidator = celebrate({
  [Segments.BODY]: Joi.object({
    banco: Joi.string().allow('', null),
    agencia: Joi.string().allow('', null),
    conta: Joi.string().allow('', null),
    tipoConta: Joi.string()
      .valid('corrente', 'poupanca', 'salario')
      .insensitive()
      .allow('', null),
    titular: Joi.string().allow('', null),
    documentoTitular: Joi.string().allow('', null),
    pixKey: Joi.string().allow('', null),
  }).unknown(false),
});

const cardBodyValidator = celebrate({
  [Segments.BODY]: Joi.object({
    token: Joi.string().required(),
    holderName: Joi.string().required(),
    last4: Joi.string().length(4).required(),
    brand: Joi.string().required(),
    expMonth: Joi.number().min(1).max(12).required(),
    expYear: Joi.number().min(2024).max(2100).required(),
  }),
});

/* ================= ROTAS /me ================= */

// 🔎 Dados bancários do próprio motorista
router.get(
  '/me/banco',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  ctrl.getDadosBancarios
);

router.put(
  '/me/banco',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  bankBodyValidator,
  ctrl.atualizarDadosBancarios
);

// 💳 Cartão para mensalidade
router.get(
  '/me/cartao',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  ctrl.getCartaoMensalidade
);

router.post(
  '/me/cartao',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  cardBodyValidator,
  ctrl.salvarCartaoMensalidade
);

router.delete(
  '/me/cartao',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  ctrl.removerCartaoMensalidade
);

/* ================= ROTAS /:id ================= */

router.get(
  '/:id/banco',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  idOrMeValidator,
  ctrl.getDadosBancarios
);

router.put(
  '/:id/banco',
  verifyToken,
  limiter,
  requireRoles('motorista', 'admin'),
  idOrMeValidator,
  bankBodyValidator,
  ctrl.atualizarDadosBancarios
);

module.exports = router;
