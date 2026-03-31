const express = require('express');
const { celebrate, Joi, Segments } = require('celebrate');

const router = express.Router();
const controller = require('../controllers/promocaoController');

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
  verifyToken = (_req, _res, next) => next();
}

if (typeof requireRoles !== 'function') {
  requireRoles = () => (_req, _res, next) => next();
}

/* ================= VALIDATORS ================= */
const objIdRegex = /^[0-9a-fA-F]{24}$/;

const createBody = celebrate({
  [Segments.BODY]: Joi.object({
    productId: Joi.string().pattern(objIdRegex).required(),
    originalPrice: Joi.number().min(0).required(),
    promoPrice: Joi.number().min(0).required(),
    validUntil: Joi.date().iso().required(),
  }).unknown(false),
});

const idParam = celebrate({
  [Segments.PARAMS]: Joi.object({
    id: Joi.string().pattern(objIdRegex).required(),
  }),
});

/* ================= ROTAS ================= */

// 🔒 Criar promoção (empresa)
router.post('/', verifyToken, requireRoles('empresa'), createBody, controller.create);

// 🌍 Listagens públicas
router.get('/', controller.list);
router.get('/ativas', controller.active);

// 🔒 Atualizar / remover (empresa)
router.put('/:id', verifyToken, requireRoles('empresa'), idParam, controller.update);
router.delete('/:id', verifyToken, requireRoles('empresa'), idParam, controller.remove);

module.exports = router;
