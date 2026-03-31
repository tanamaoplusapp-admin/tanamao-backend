const express = require('express');
const rateLimit = require('express-rate-limit');
const { celebrate, Segments, Joi } = require('celebrate');

const router = express.Router();

const sendEmail = require('../utils/sendEmail');
const config = require('../config/env');

// 🔐 Auth middleware (compatível com os dois padrões)
let verifyToken;
try {
  const auth = require('../middleware/verifyToken'); // ✅ FIX
  verifyToken = auth.verifyToken;
} catch (_) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken || auth;
  } catch (_) {
    verifyToken = null;
  }
}

// -------- Rate limit básico --------
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// -------- Validators --------
const emailValidator = Joi.string().email().trim();

const sendBodyValidator = celebrate({
  [Segments.BODY]: Joi.object({
    to: emailValidator.optional(),
    subject: Joi.string().trim().max(120).default('Mensagem TáNaMão+'),
    html: Joi.string().trim().allow('').default(''),
    text: Joi.string().trim().allow('').default(''),
    cc: Joi.alternatives().try(emailValidator, Joi.array().items(emailValidator)).optional(),
    bcc: Joi.alternatives().try(emailValidator, Joi.array().items(emailValidator)).optional(),
  }).custom((val, helpers) => {
    if (!val.html && !val.text) {
      return helpers.error('any.custom', { message: 'Informe "html" ou "text".' });
    }
    return val;
  }, 'payload check'),
});

// helper: auth opcional
const chain = (...mws) =>
  verifyToken ? [verifyToken, limiter, ...mws] : [limiter, ...mws];

/**
 * POST /api/email/teste
 */
router.post(
  '/teste',
  ...chain(
    celebrate({
      [Segments.BODY]: Joi.object({
        to: emailValidator.optional(),
      }),
    })
  ),
  async (req, res) => {
    try {
      if (!config.email?.enabled) {
        return res.status(503).json({ message: 'Envio de e-mails desativado no servidor.' });
      }

      const to = req.body.to || req.user?.email;
      if (!to) return res.status(400).json({ message: 'Informe o destinatário em "to".' });

      await sendEmail({
        to,
        subject: 'Teste de e-mail - TáNaMão+',
        html: `<h2>Funcionou!</h2><p>Este é um teste de envio de e-mail com o app <strong>TáNaMão+</strong>.</p>`,
        text: 'Funcionou! Este é um teste de envio de e-mail com o app TáNaMão+.',
      });

      return res.status(200).json({ message: 'E-mail de teste enviado com sucesso.' });
    } catch (error) {
      console.error('[email/teste] erro:', error);
      return res.status(500).json({ message: 'Erro ao enviar e-mail de teste.' });
    }
  }
);

/**
 * POST /api/email/send
 */
router.post(
  '/send',
  ...chain(sendBodyValidator),
  async (req, res) => {
    try {
      if (!config.email?.enabled) {
        return res.status(503).json({ message: 'Envio de e-mails desativado no servidor.' });
      }

      const { to: toBody, subject, html, text, cc, bcc } = req.body;
      const to = toBody || req.user?.email;
      if (!to) return res.status(400).json({ message: 'Informe o destinatário em "to".' });

      await sendEmail({
        to,
        subject,
        html: html || undefined,
        text: text || undefined,
        cc,
        bcc,
      });

      return res.status(200).json({ message: 'E-mail enviado com sucesso.' });
    } catch (error) {
      console.error('[email/send] erro:', error);
      return res.status(500).json({ message: 'Erro ao enviar e-mail.' });
    }
  }
);

module.exports = router;
