const express = require('express');
const rateLimit = require('express-rate-limit');
const { celebrate, Segments, Joi } = require('celebrate');

const router = express.Router();

// 🔐 Auth middleware (aceita ambos nomes)
let verifyToken, requireRoles;
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
    console.warn('[mensalidadeRoutes] WARNING: middleware de auth não encontrado.');
    verifyToken = (_req, _res, next) => next();
    requireRoles = () => (_req, _res, next) => next();
  }
}

if (typeof requireRoles !== 'function') {
  requireRoles = () => (_req, _res, next) => next();
}

const {
  gerarPagamentoMensalidade,
  cobrarMensalidades,
} = require('../services/mensalidadeService');

const User = require('../models/user');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const cobrarValidator = celebrate({
  [Segments.BODY]: Joi.object({
    metodo: Joi.string().valid('pix', 'card', 'boleto').default('pix'),
    cardToken: Joi.string().allow('', null),
    cardNetwork: Joi.string().allow('', null),
    cardLast4: Joi.string().pattern(/^\d{4}$/).allow('', null),
  }).unknown(true),
});

/**
 * 📌 POST /api/mensalidade/cobrar
 */
router.post(
  '/cobrar',
  verifyToken,
  limiter,
  cobrarValidator,
  async (req, res) => {
    try {

      const metodo = req.body.metodo || 'pix';
      const user = req.user;

      const resultado = await gerarPagamentoMensalidade(user, metodo);

      return res.status(200).json({
        status: resultado.status,
        paymentId: resultado.paymentId,
        valor: resultado.valor,
        qr_code: resultado.qr_code,
        qr_code_base64: resultado.qr_code_base64,
      });

    } catch (error) {
      console.error('❌ Erro na rota /mensalidade/cobrar:', error);
      res.status(500).json({ error: 'Erro ao gerar cobrança de mensalidade' });
    }
  }
);

/**
 * 📊 GET /api/mensalidade/status
 */
router.get(
  '/status',
  verifyToken,
  async (req,res)=>{

    const user = await User.findById(req.user._id);

    res.json({

      planType: user.planType,

      subscriptionStatus: user.subscriptionStatus,

      subscriptionExpiresAt: user.subscriptionExpiresAt,

      comissaoPendente: user.comissaoPendente,

      bloqueado:
        user.subscriptionStatus === 'overdue' ||
        user.comissaoPendente > 0

    });

  }
);

/**
 * 📊 GET /api/mensalidade/resumo
 */
router.get(
  '/resumo',
  verifyToken,
  async (req,res)=>{

    const user = await User.findById(req.user._id);

    res.json({

      plano:user.planType,

      mensalidade:{
        status:user.subscriptionStatus,
        venceEm:user.subscriptionExpiresAt
      },

      comissao:{
        pendente:user.comissaoPendente
      },

      bloqueado:
        user.subscriptionStatus === 'overdue' ||
        user.comissaoPendente > 0

    });

  }
);

/**
 * 🛠️ POST /api/mensalidade/testar-cobranca
 */
router.post(
  '/testar-cobranca',
  verifyToken,
  requireRoles('admin'),
  limiter,
  async (_req, res) => {
    try {
      await cobrarMensalidades();
      res.json({ message: 'Cobrança de mensalidades executada com sucesso!' });
    } catch (error) {
      console.error('❌ Erro na cobrança manual:', error);
      res.status(500).json({
        error: 'Erro ao executar cobrança manual',
        details: error.message,
      });
    }
  }
);

router.get('/', (_req, res) => {
  res.json({ ok: true, route: 'mensalidade' });
});

module.exports = router;