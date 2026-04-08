// models/Transaction.js

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    /* =========================
       VÍNCULOS
    ========================= */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },

    // compatibilidade com código antigo do financeiro
    profissional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    /* =========================
       DADOS PRINCIPAIS
    ========================= */

    description: {
      type: String,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      default: 0,
    },

    currency: {
      type: String,
      default: 'BRL',
      trim: true,
    },

    type: {
      type: String,
      enum: [
        'service_payment',
        'commission_payment',
        'monthly_fee',
        'refund',

        // novos tipos úteis no fluxo atual
        'access',
        'subscription',
        'credits',
        'manual',
      ],
      required: true,
      default: 'manual',
      index: true,
    },

    role: {
      type: String,
      enum: ['cliente', 'profissional', 'empresa', 'motorista'],
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['pix', 'card', 'cash', 'manual'],
      default: 'pix',
      index: true,
    },

    // compatibilidade com webhook/controller novo
    method: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'failed',
        'refunded',
        'rejected',
        'cancelled',
        'in_process',
      ],
      default: 'pending',
      index: true,
    },

    /* =========================
       IDs EXTERNOS / GATEWAY
    ========================= */

    // legado
    paymentId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },

    // principal para Mercado Pago / webhook
    mpPaymentId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },

    /* =========================
       METADADOS
    ========================= */

    metadata: {
      type: Object,
      default: {},
    },

    raw: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /* =========================
       CONTROLE DE APLICAÇÃO
       (idempotência do webhook)
    ========================= */

    aplicadoAoUsuario: {
      type: Boolean,
      default: false,
      index: true,
    },

    aplicadoEm: {
      type: Date,
      default: null,
    },

    diasLiberados: {
      type: Number,
      default: 0,
    },

    planoAplicado: {
      type: String,
      trim: true,
    },

    acessoExpiraEm: {
      type: Date,
      default: null,
    },

    motivoNaoAplicado: {
      type: String,
      trim: true,
    },

    valorEsperado: {
      type: Number,
      default: null,
    },

    valorPago: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

/* =========================
   INDEXES
========================= */

schema.index({ createdAt: -1 });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ companyId: 1, createdAt: -1 });
schema.index({ orderId: 1, createdAt: -1 });
schema.index({ profissional: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ type: 1, createdAt: -1 });
schema.index({ paymentMethod: 1, createdAt: -1 });

// importante para webhook/idempotência
schema.index(
  { mpPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { mpPaymentId: { $type: 'string' } },
  }
);

// compatibilidade se ainda houver fluxos antigos usando paymentId
schema.index(
  { paymentId: 1 },
  {
    partialFilterExpression: { paymentId: { $type: 'string' } },
  }
);

module.exports =
  mongoose.models.Transaction ||
  mongoose.model('Transaction', schema);