// models/PagamentoMensalidade.js
const mongoose = require('mongoose');

const pagamentoMensalidadeSchema = new mongoose.Schema(
  {
    // Quem será cobrado
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Para empresas que usam model separado
    empresaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    tipoUsuario: {
      type: String,
      enum: ['cliente', 'empresa', 'profissional', 'motorista'],
      required: true,
      index: true,
    },

    // Competência da mensalidade (YYYY-MM) — evita duplicidade por mês
    competencia: {
      type: String, // ex.: "2025-08"
      required: true,
    },

    // Valor a cobrar
    valor: {
      type: Number,
      required: true,
      min: 0,
    },

    // Método de cobrança escolhido
    metodo: {
      type: String,
      enum: ['pix', 'card', 'boleto'],
      required: true,
    },

    // Status do ciclo de cobrança
    status: {
      type: String,
      enum: ['pendente', 'pago', 'falhou', 'cancelado', 'isento', 'expirado'],
      default: 'pendente',
      index: true,
    },

    /* --------- Dados do provedor de pagamento (Mercado Pago) --------- */
    paymentId: { type: String, index: true }, // id do pagamento gerado
    preferenceId: { type: String },           // se usar preferências
    status_detail: { type: String },

    // PIX
    qr_code: String,
    qr_code_base64: String,
    expiration_time: Date,

    // Cartão (autodebito)
    autoDebit: { type: Boolean, default: false }, // habilitado p/ cobrar automático
    mpCustomerId: { type: String },               // cliente no MP
    mpCardId: { type: String },                   // cartão salvo no MP
    card: {
      last4: String,
      brand: String, // visa/master/etc
    },

    /* --------- Auditoria / Retentativas --------- */
    paidAt: Date,
    cancelledAt: Date,
    attempts: { type: Number, default: 0 },
    lastAttemptAt: Date,
    errorMessage: String,
    createdByCron: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Evita duplicidade: uma mensalidade por usuário/tipo/competência
pagamentoMensalidadeSchema.index(
  { userId: 1, tipoUsuario: 1, competencia: 1 },
  { unique: true }
);

// Compat: alguns códigos antigos usam "criadoEm"
pagamentoMensalidadeSchema.virtual('criadoEm').get(function () {
  return this.createdAt;
});

module.exports = mongoose.model('PagamentoMensalidade', pagamentoMensalidadeSchema);
