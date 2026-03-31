// routes/companyExtraRoutes.js
const express = require('express');
const router = express.Router();
const { celebrate, Joi, Segments } = require('celebrate');

// Se você tiver um model Company, importe aqui.
// Caso não tenha, a validação será apenas estrutural.
let Company;
try {
  Company = require('./models/Company');
} catch (_) {
  Company = null;
}

router.post(
  '/validate',
  celebrate({
    [Segments.BODY]: Joi.object({
      nome: Joi.string().min(2).required(),
      email: Joi.string().email().required(),
      cnpj: Joi.string().pattern(/^\d{14}$/).required(),
      telefone: Joi.string().min(8).required(),
      porte: Joi.string().valid('mei', 'pequena', 'media', 'grande').required(),
    }).unknown(false),
  }),
  async (req, res) => {
    try {
      const { email, cnpj } = req.body;

      if (!Company) {
        // Sem model, fazemos só validações básicas.
        return res.json({
          ok: true,
          porteNormalizado: req.body.porte,
          comissao: 0.1,
          mensalidade: 0, // você pode ajustar conforme política
        });
      }

      const dup = await Company.findOne({
        $or: [{ email }, { cnpj }],
      }).lean();

      if (dup) {
        return res.status(409).json({ error: 'Empresa já cadastrada (email ou CNPJ).' });
      }

      return res.json({
        ok: true,
        porteNormalizado: req.body.porte,
        comissao: 0.1,
        mensalidade: 0,
      });
    } catch (err) {
      console.error('[companies/validate]', err);
      return res.status(500).json({ error: 'Falha ao validar empresa.' });
    }
  }
);

module.exports = router;
