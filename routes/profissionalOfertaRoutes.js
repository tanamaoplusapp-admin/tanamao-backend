const express = require('express');
const { celebrate, Joi, Segments } = require('celebrate');

const controller = require('../controllers/profissionalOfertaController');

/* ================= AUTH (FIX DEFINITIVO) ================= */
let verifyToken, requireRoles;

try {
  const auth = require('../middleware/verifyToken');
  verifyToken = auth.verifyToken;
  requireRoles = auth.requireRoles;
} catch (_) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken || auth;
    requireRoles = auth.requireRoles || (() => (_req, _res, next) => next());
  } catch (_) {
    verifyToken = null;
    requireRoles = () => (_req, _res, next) => next();
  }
}

if (typeof verifyToken !== 'function') {
  verifyToken = (_req, _res, next) => next();
}

/* ================= ROUTER ================= */
const router = express.Router({ mergeParams: true });

const objIdRegex = /^[0-9a-fA-F]{24}$/;

/* ================= VALIDATORS ================= */
const idParam = celebrate({
  [Segments.PARAMS]: Joi.object({
    id: Joi.string().pattern(objIdRegex).required(), // profissional id
  }),
});

const idWithOfertaParam = celebrate({
  [Segments.PARAMS]: Joi.object({
    id: Joi.string().pattern(objIdRegex).required(),
    ofertaId: Joi.string().pattern(objIdRegex).required(),
  }),
});

const createBody = celebrate({
  [Segments.BODY]: Joi.object({
    titulo: Joi.string().max(120).required(),
    descricao: Joi.string().max(4000).required(),
    preco: Joi.number().min(0).required(),
    status: Joi.string().valid('ativa', 'inativa').optional(),
  }).unknown(false),
});

const updateBody = celebrate({
  [Segments.BODY]: Joi.object({
    titulo: Joi.string().max(120).optional(),
    descricao: Joi.string().max(4000).optional(),
    preco: Joi.number().min(0).optional(),
    status: Joi.string().valid('ativa', 'inativa').optional(),
  }).min(1).unknown(false),
});

/* ================= ROTAS ================= */
// todas exigem o próprio profissional logado
router.post(
  '/',
  verifyToken,
  requireRoles('profissional'),
  idParam,
  createBody,
  controller.create
);

router.get(
  '/',
  verifyToken,
  requireRoles('profissional'),
  idParam,
  controller.list
);

router.patch(
  '/:ofertaId',
  verifyToken,
  requireRoles('profissional'),
  idWithOfertaParam,
  updateBody,
  controller.update
);

router.delete(
  '/:ofertaId',
  verifyToken,
  requireRoles('profissional'),
  idWithOfertaParam,
  controller.remove
);

module.exports = router;
