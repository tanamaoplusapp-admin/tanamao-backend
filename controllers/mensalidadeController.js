// controllers/mensalidadeController.js
const Motorista = require('../models/Motorista');

const getUserId = (req) => (req.user?._id || req.userId || req.user?.id || '').toString();

const salvarMetodoPagamento = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { cardToken, payer } = req.body || {};

    if (!cardToken) {
      return res.status(422).json({ message: 'cardToken é obrigatório.' });
    }

    const set = {
      'billing.metodo': 'cartao',
      'billing.cardToken': cardToken,
      'billing.payer': payer || null,
      'billing.updatedAt': new Date(),
    };

    await Motorista.updateOne({ _id: userId }, { $set: set }, { upsert: true });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[mensalidade/metodo]', err);
    return res.status(500).json({ message: 'Erro ao salvar método de pagamento.' });
  }
};

/* ✅ EXPORT EXPLÍCITO — CORREÇÃO DEFINITIVA */
module.exports = {
  salvarMetodoPagamento,
};
