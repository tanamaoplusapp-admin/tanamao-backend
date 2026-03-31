// models/Order.js
const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema(
  {
    // MP / método de pagamento
    metodo: { type: String, enum: ['pix', 'card', 'cash'] },
    idPagamento: { type: String, index: true }, // ID do Mercado Pago

    status: {
      // status do pagamento no MP
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'refunded',
        'charged_back',
        'in_process',
        'in_mediation',
        'expired',
        'authorized',
        'voided',
      ],
      default: 'pending',
      index: true,
    },
    status_detail: String, // ex.: accredited, pending_waiting_payment, etc.

    // Comissão (duplicada aqui e nos campos legados para compat)
    porcentagem: { type: Number, default: 0 },
    comissao: { type: Number, default: 0 },
    valorLiquido: { type: Number, default: 0 },

    // PIX extras
    expiration_time: { type: Date }, // quando expira o QR
    qr_code: String,                  // copia e cola
    qr_code_base64: String,           // imagem base64 (data uri)
  },
  { _id: false, timestamps: false }
);

const orderSchema = new mongoose.Schema(
  {
    /* -------- Relacionamentos -------- */
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    empresaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    motoristaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // ou 'Driver' se houver model separado
      required: false,
      index: true,
    },

    /* -------- Itens -------- */
    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        nome: String,
        quantidade: { type: Number, min: 1, default: 1 },
        preco: { type: Number, min: 0, default: 0 },
      },
    ],

    /* -------- Totais -------- */
    total: { type: Number, required: true, min: 0 },

    /* -------- Campos legados (mantidos p/ compat) -------- */
    formaPagamento: {
      type: String,
      enum: ['Pix', 'Cartão', 'Dinheiro'],
      required: true,
    },
    comissao: { type: Number, required: true, min: 0 },
    valorLiquido: { type: Number, required: true, min: 0 },

    /* -------- Status de entrega (fluxo operacional) --------
       Padrão adotado: 'em_rota'. Mantemos compat com sinônimos via normalização.
    */
    deliveryStatus: {
      type: String,
      enum: ['aguardando', 'preparando', 'em_rota', 'entregue', 'cancelado'],
      default: 'aguardando',
      index: true,
    },

    /* -------- Telemetria / Datas -------- */
    localizacaoAtual: {
      latitude: Number,
      longitude: Number,
    },
    entregueEm: { type: Date },
    dataPedido: { type: Date, default: Date.now },

    /* -------- Pagamento (subdoc) -------- */
    pagamento: pagamentoSchema,

    /* -------- Histórico simples de status (opcional) -------- */
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['aguardando', 'preparando', 'em_rota', 'entregue', 'cancelado'],
        },
        at: { type: Date, default: Date.now },
        obs: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

/* ========== Virtuais / Compat ========== */
// Compat: manter order.status como alias de deliveryStatus
orderSchema
  .virtual('status')
  .get(function () {
    return this.deliveryStatus;
  })
  .set(function (v) {
    this.deliveryStatus = v;
  });

/* ========== Normalizações & Compat ========== */
function normalizeDeliveryStatus(v) {
  if (!v) return v;
  const s = String(v).toLowerCase().trim();
  // sinônimos legados
  if (s === 'saiu_para_entrega' || s === 'em rota' || s === 'em-rota') return 'em_rota';
  return s;
}

function normalizeFormaPagamento(legado) {
  if (!legado) return legado;
  const s = String(legado).toLowerCase();
  if (s.includes('pix')) return 'Pix';
  if (s.includes('cart')) return 'Cartão';
  if (s.includes('din')) return 'Dinheiro';
  return legado;
}

function ensureLegacyFromPagamento(doc) {
  // Garantir que campos legados batem com subdocumento pagamento (quando vier do fluxo MP)
  if (doc.pagamento) {
    if (!doc.comissao && typeof doc.pagamento.comissao === 'number') {
      doc.comissao = doc.pagamento.comissao;
    }
    if (!doc.valorLiquido && typeof doc.pagamento.valorLiquido === 'number') {
      doc.valorLiquido = doc.pagamento.valorLiquido;
    }
    if (!doc.formaPagamento && doc.pagamento.metodo) {
      if (doc.pagamento.metodo === 'pix') doc.formaPagamento = 'Pix';
      if (doc.pagamento.metodo === 'card') doc.formaPagamento = 'Cartão';
      if (doc.pagamento.metodo === 'cash') doc.formaPagamento = 'Dinheiro';
    }
  }
}

orderSchema.pre('validate', function (next) {
  // normaliza deliveryStatus (inclui sinônimos)
  this.deliveryStatus = normalizeDeliveryStatus(this.deliveryStatus) || this.deliveryStatus;

  // normaliza formaPagamento legado
  this.formaPagamento = normalizeFormaPagamento(this.formaPagamento);

  // alinha campos legados a partir do subdoc pagamento, se necessário
  ensureLegacyFromPagamento(this);

  next();
});

orderSchema.pre('save', function (next) {
  // mais uma garantia para sinônimos antigos
  this.deliveryStatus = normalizeDeliveryStatus(this.deliveryStatus) || this.deliveryStatus;

  // Sincroniza legados <- pagamento (se ainda faltou algo)
  ensureLegacyFromPagamento(this);

  // Registra no histórico se mudou status
  if (this.isModified('deliveryStatus')) {
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({ status: this.deliveryStatus, at: new Date() });
  }

  next();
});

// também normaliza em updates diretos
orderSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  if (update.deliveryStatus) {
    update.deliveryStatus = normalizeDeliveryStatus(update.deliveryStatus);
    this.setUpdate(update);
  }
  next();
});

/* ========== Índices úteis ========== */
orderSchema.index({ empresaId: 1, createdAt: -1 });
orderSchema.index({ empresaId: 1, deliveryStatus: 1 });
orderSchema.index({ clienteId: 1, createdAt: -1 });
orderSchema.index({ 'pagamento.status': 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

/* ========== Helpers de domínio ========== */
orderSchema.methods.applyCommission = function ({ porcentagem, comissao, valorLiquido }) {
  if (!this.pagamento) this.pagamento = {};
  if (typeof porcentagem === 'number') this.pagamento.porcentagem = porcentagem;
  if (typeof comissao === 'number') {
    this.comissao = comissao; // legado
    this.pagamento.comissao = comissao;
  }
  if (typeof valorLiquido === 'number') {
    this.valorLiquido = valorLiquido; // legado
    this.pagamento.valorLiquido = valorLiquido;
  }
};

orderSchema.methods.markPaid = function () {
  if (!this.pagamento) this.pagamento = {};
  this.pagamento.status = 'approved';
  if (this.deliveryStatus === 'aguardando') {
    this.deliveryStatus = 'preparando';
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({ status: this.deliveryStatus, at: new Date(), obs: 'Pagamento aprovado' });
  }
};

orderSchema.methods.markOutForDelivery = function () {
  this.deliveryStatus = 'em_rota';
  this.statusHistory = this.statusHistory || [];
  this.statusHistory.push({ status: 'em_rota', at: new Date() });
};

orderSchema.methods.markDelivered = function () {
  this.deliveryStatus = 'entregue';
  this.entregueEm = new Date();
  this.statusHistory = this.statusHistory || [];
  this.statusHistory.push({ status: 'entregue', at: this.entregueEm });
};

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);

