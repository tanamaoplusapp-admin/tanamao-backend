// routes/freteRoutes.js
const express = require('express');
const { celebrate, Joi, Segments } = require('celebrate');

const router = express.Router();
const controller = require('../controllers/freteController');

// Middlewares de auth (com fallback, igual aos outros módulos)
let verifyToken, requireRoles;
try {
  ({ requireRoles } = require('../middleware/verifyToken'));
  verifyToken = require('../middleware/verifyToken');
} catch (_) {
  try {
    ({ requireRoles } = require('../middleware/authMiddleware'));
    verifyToken = require('../middleware/authMiddleware');
  } catch {
    // fallback: rotas públicas (pode manter pública a cotação)
    verifyToken = (req, _res, next) => next();
    requireRoles = () => (req, _res, next) => next();
    console.warn('[freteRoutes] WARNING: sem middleware de auth; rota pública.');
  }
}

const cotarBody = celebrate({
  [Segments.BODY]: Joi.object({
    cep: Joi.string().required(),
    itens: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().allow('', null),
          quantidade: Joi.number().min(1).default(1),
          empresaId: Joi.string().allow('', null),
          peso: Joi.number().min(0).allow(null),
          volume: Joi.number().min(0).allow(null),
        })
      )
      .min(1)
      .required(),
    empresas: Joi.array().items(Joi.string()).optional(),
  }).unknown(false),
});

// Se quiser proteger a rota, troque verifyToken por verifyToken, requireRoles('cliente') etc.
router.post('/cotar', /* verifyToken, */ cotarBody, controller.cotar);

module.exports = router;
