// backend/controllers/mercadoPagoWebhookController.js

const { mp, Payment } = require('../services/mercadoPago');
const User = require('../models/user');
const Transaction = require('../models/transaction');
const mongoose = require('mongoose');

/**
 * Webhook Mercado Pago
 * Recebe eventos de pagamento e atualiza estado real do sistema
 */
exports.webhook = async (req, res) => {
  try {

    const { type, data } = req.body || {};

    // ignorar eventos não pagamento
    if (type !== 'payment' || !data?.id) {
      return res.sendStatus(200);
    }

    // buscar pagamento no MP
    const payment = await new Payment(mp).get({ id: data.id });

    if (!payment || !payment.id) {
      return res.sendStatus(200);
    }

    const status = payment.status;
    const metadata = payment.metadata || {};

    /* =====================================
       REGISTRAR TRANSACTION (opcional)
    ===================================== */

    if (Transaction && mongoose.models.Transaction) {

      await Transaction.findOneAndUpdate(
        { mpPaymentId: payment.id },
        {
          mpPaymentId: payment.id,
          status: status,
          amount: payment.transaction_amount,
          currency: payment.currency_id,
          method: payment.payment_method_id,
          userId: metadata.user_id || null,
          companyId: metadata.company_id || null,
          orderId: metadata.order_id || null,
          raw: payment,
        },
        { upsert: true, new: true }
      );

    }

    /* =====================================
       ATUALIZAR USUÁRIO
    ===================================== */

    if (status === 'approved' && metadata.user_id) {

      const user = await User.findById(metadata.user_id);

      if (!user) return res.sendStatus(200);

      /* =============================
         PLANO POR DIAS
      ============================= */

      if (metadata.type === 'plano') {

        const plano = metadata.plano; // 1dia,7dias,15dias,30dias

        const diasPorPlano = {
          '1dia': 1,
          '7dias': 7,
          '15dias': 15,
          '30dias': 30
        };

        const dias = diasPorPlano[plano];

        if (dias) {

          const agora = new Date();

          const expira = new Date(
            agora.getTime() + dias * 24 * 60 * 60 * 1000
          );

          user.acessoExpiraEm = expira;
          user.planoAtivo = plano;

        }

      }

      await user.save();
    }

    return res.sendStatus(200);

  } catch (err) {

    console.error('[MP webhook] erro:', err);

    // MP exige 200
    return res.sendStatus(200);
  }
};