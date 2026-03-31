const express = require('express');
const rateLimit = require('express-rate-limit');
const { celebrate, Joi, Segments } = require('celebrate');
const { createReview, getReviewsByProfessional } = require('../controllers/reviewController');

const router = express.Router();

// tenta ambos middlewares de auth para compatibilidade
let verifyToken;
try {
  ({ verifyToken } = require('../middleware/verifyToken')); // ✅ FIX
} catch (_) {
  try {
    verifyToken = require('../middleware/authMiddleware');
  } catch {
    console.warn('[reviewRoutes] WARNING: verifyToken/authMiddleware não encontrado. POST ficará sem proteção!');
    verifyToken = (req, _res, next) => next();
  }
}

// limiter para evitar spam de avaliações
const postLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 50,                  // até 50 avaliações/10min por IP
  standardHeaders: true,
  legacyHeaders: false,
});

const objectId = Joi.string().length(24).hex();

// injeta o clientId do usuário autenticado (se existir)
const injectClientId = (req, _res, next) => {
  if (!req.body) req.body = {};
  if (!req.body.clientId && req.user?._id) {
    req.body.clientId = req.user._id.toString();
  }
  next();
};

/**
 * POST /api/reviews
 * Cria uma avaliação (cliente -> profissional)
 */
router.post(
  '/',
  verifyToken,
  postLimiter,
  celebrate({
    [Segments.BODY]: Joi.object({
      professionalId: objectId.required(),
      rating: Joi.number().integer().min(1).max(5).required(),
      comment: Joi.string().max(1000).allow('', null),
      clientId: objectId.optional(),
    }).unknown(false),
  }),
  injectClientId,
  createReview
);

/**
 * GET /api/reviews/:professionalId
 * Lista avaliações de um profissional (público)
 */
router.get(
  '/:professionalId',
  celebrate({
    [Segments.PARAMS]: Joi.object({
      professionalId: objectId.required(),
    }),
  }),
  getReviewsByProfessional
);

module.exports = router;
