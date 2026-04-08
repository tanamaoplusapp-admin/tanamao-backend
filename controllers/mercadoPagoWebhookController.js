// backend/controllers/mercadoPagoWebhookController.js

const mongoose = require('mongoose');
const { mp, Payment } = require('../services/mercadoPago');
const User = require('../models/user');
const Transaction = require('../models/Transaction');

/* =========================================================
HELPERS
========================================================= */

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMoney(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

function normalizePaymentMethod(method) {
  const m = String(method || '').trim().toLowerCase();

  if (m === 'pix') return 'pix';
  if (
    m === 'credit_card' ||
    m === 'debit_card' ||
    m === 'card'
  ) {
    return 'card';
  }
  if (m === 'cash') return 'cash';

  return 'manual';
}

function getBaseDate(user) {
  const now = new Date();

  if (user?.acessoExpiraEm && new Date(user.acessoExpiraEm) > now) {
    return new Date(user.acessoExpiraEm);
  }

  return now;
}

function addDays(date, days) {
  return new Date(date.getTime() + Number(days) * 24 * 60 * 60 * 1000);
}

function inferPlanFromMetadata(metadata = {}) {
  const type = String(metadata.type || '').trim().toLowerCase();
  const dias = toNumber(metadata.dias, 0);
  const planoRaw = String(metadata.plano || '').trim().toLowerCase();

  // Fluxo atual /credits
  if (type === 'access') {
    if (dias === 1) return { dias: 1, planoAtivo: '1_dia', txType: 'access' };
    if (dias === 7) return { dias: 7, planoAtivo: '7_dias', txType: 'access' };
    if (dias === 15) return { dias: 15, planoAtivo: '15_dias', txType: 'access' };
  }

  // Fluxo atual /subscription
  if (type === 'subscription') {
    if (dias === 30 || !dias) {
      return { dias: 30, planoAtivo: '30_dias', txType: 'subscription' };
    }
  }

  // Compatibilidade com formatos alternativos/antigos
  if (type === 'plano') {
    const map = {
      '1dia': { dias: 1, planoAtivo: '1_dia', txType: 'access' },
      '1_dia': { dias: 1, planoAtivo: '1_dia', txType: 'access' },
      '7dias': { dias: 7, planoAtivo: '7_dias', txType: 'access' },
      '7_dias': { dias: 7, planoAtivo: '7_dias', txType: 'access' },
      '15dias': { dias: 15, planoAtivo: '15_dias', txType: 'access' },
      '15_dias': { dias: 15, planoAtivo: '15_dias', txType: 'access' },
      '30dias': { dias: 30, planoAtivo: '30_dias', txType: 'subscription' },
      '30_dias': { dias: 30, planoAtivo: '30_dias', txType: 'subscription' },
    };

    if (map[planoRaw]) return map[planoRaw];
  }

  // Compatibilidade: monthly_fee antigo
  if (type === 'monthly_fee') {
    return { dias: 30, planoAtivo: '30_dias', txType: 'monthly_fee' };
  }

  return null;
}

function inferExpectedAmount(planInfo) {
  if (!planInfo) return null;

  const prices = {
    1: 49.90,
    7: 79.90,
    15: 99.90,
    30: 129.90,
  };

  return prices[planInfo.dias] || null;
}

function getSafeObjectId(value) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

/* =========================================================
TRANSACTION UPSERT
========================================================= */

async function upsertTransaction(payment, metadata, planInfo) {
  const mpPaymentId = String(payment.id);

  const payload = {
    userId: getSafeObjectId(metadata.user_id),
    companyId: getSafeObjectId(metadata.company_id || metadata.empresaId),
    orderId: getSafeObjectId(metadata.order_id),

    // compatibilidade com controller financeiro antigo
    profissional: getSafeObjectId(metadata.user_id),

    description:
      payment.description ||
      (planInfo?.planoAtivo
        ? `Pagamento plano ${planInfo.planoAtivo}`
        : 'Pagamento Mercado Pago'),

    amount: normalizeMoney(payment.transaction_amount),
    currency: payment.currency_id || 'BRL',

    type: planInfo?.txType || metadata.type || 'manual',
    role: 'profissional',

    paymentMethod: normalizePaymentMethod(payment.payment_method_id),
    method: payment.payment_method_id || null,

    status: String(payment.status || 'pending').toLowerCase(),

    paymentId: mpPaymentId,
    mpPaymentId,

    metadata,
    raw: payment,
  };

  const tx = await Transaction.findOneAndUpdate(
    { mpPaymentId },
    { $set: payload, $setOnInsert: { aplicadoAoUsuario: false } },
    { upsert: true, new: true }
  );

  return tx;
}

/* =========================================================
WEBHOOK
========================================================= */

exports.webhook = async (req, res) => {
  try {
    const body = req.body || {};
    const eventType = body.type || body.topic;
    const paymentId = body.data?.id || body.id;

    // Ignora outros eventos, mas responde 200
    if (eventType !== 'payment' || !paymentId) {
      return res.sendStatus(200);
    }

    const payment = await new Payment(mp).get({ id: paymentId });

    if (!payment || !payment.id) {
      return res.sendStatus(200);
    }

    const status = String(payment.status || '').toLowerCase();
    const metadata = payment.metadata || {};
    const planInfo = inferPlanFromMetadata(metadata);

    const tx = await upsertTransaction(payment, metadata, planInfo);

    // Só approved aplica acesso
    if (status !== 'approved') {
      return res.sendStatus(200);
    }

    // Idempotência: se já aplicou, sai
    if (tx.aplicadoAoUsuario) {
      return res.sendStatus(200);
    }

    const userId = metadata.user_id;

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      await Transaction.findOneAndUpdate(
        { mpPaymentId: String(payment.id) },
        {
          $set: {
            aplicadoAoUsuario: false,
            motivoNaoAplicado: 'user_id_invalido',
          },
        }
      );

      return res.sendStatus(200);
    }

    const user = await User.findById(userId);

    if (!user) {
      await Transaction.findOneAndUpdate(
        { mpPaymentId: String(payment.id) },
        {
          $set: {
            aplicadoAoUsuario: false,
            motivoNaoAplicado: 'user_nao_encontrado',
          },
        }
      );

      return res.sendStatus(200);
    }

    // Se não for plano/acesso, só registra transação
    if (!planInfo) {
      await Transaction.findOneAndUpdate(
        { mpPaymentId: String(payment.id) },
        {
          $set: {
            aplicadoAoUsuario: false,
            motivoNaoAplicado: 'tipo_nao_tratado',
          },
        }
      );

      return res.sendStatus(200);
    }

    // Validação de valor esperado
    const expectedAmount = inferExpectedAmount(planInfo);
    const paidAmount = normalizeMoney(payment.transaction_amount);

    if (expectedAmount !== null && normalizeMoney(expectedAmount) !== paidAmount) {
      await Transaction.findOneAndUpdate(
        { mpPaymentId: String(payment.id) },
        {
          $set: {
            aplicadoAoUsuario: false,
            motivoNaoAplicado: 'valor_divergente',
            valorEsperado: expectedAmount,
            valorPago: paidAmount,
          },
        }
      );

      return res.sendStatus(200);
    }

    // Soma a partir da expiração atual se ainda estiver válida
    const base = getBaseDate(user);
    const novaExpiracao = addDays(base, planInfo.dias);

    user.acessoExpiraEm = novaExpiracao;
    user.planoAtivo = planInfo.planoAtivo;

    // Compatibilidade com outros campos possíveis do schema User
    if ('subscriptionStatus' in user) {
      user.subscriptionStatus = 'active';
    }

    if ('subscriptionExpiresAt' in user) {
      user.subscriptionExpiresAt = novaExpiracao;
    }

    if ('ultimoPagamentoEm' in user) {
      user.ultimoPagamentoEm = new Date();
    }

    if ('proximoVencimentoEm' in user) {
      user.proximoVencimentoEm = novaExpiracao;
    }

    await user.save();

    await Transaction.findOneAndUpdate(
      { mpPaymentId: String(payment.id) },
      {
        $set: {
          aplicadoAoUsuario: true,
          aplicadoEm: new Date(),
          diasLiberados: planInfo.dias,
          planoAplicado: planInfo.planoAtivo,
          acessoExpiraEm: novaExpiracao,
          valorEsperado: expectedAmount,
          valorPago: paidAmount,
          motivoNaoAplicado: null,
        },
      }
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error('[MP webhook] erro:', err);

    // MP exige 200 para evitar retries infinitos por erro interno
    return res.sendStatus(200);
  }
};