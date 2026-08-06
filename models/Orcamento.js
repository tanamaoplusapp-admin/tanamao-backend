const mongoose = require('mongoose');

/* ==========================================
   ITEM DO ORÇAMENTO
========================================== */

const itemSchema = new mongoose.Schema(
  {
    descricao: {
      type: String,
      required: true,
      trim: true,
    },

    quantidade: {
      type: Number,
      default: 1,
      min: 1,
    },

    valorUnitario: {
      type: Number,
      required: true,
      min: 0,
    },

    desconto: {
      type: Number,
      default: 0,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

/* ==========================================
   ORÇAMENTO
========================================== */

const orcamentoSchema = new mongoose.Schema(
  {
    /* ===============================
       IDENTIFICAÇÃO
    =============================== */

    numero: {
      type: String,
      unique: true,
      index: true,
    },

    titulo: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    /* ===============================
       PROFISSIONAL
    =============================== */

    profissionalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profissional',
      required: true,
      index: true,
    },

    profissional: {
      nome: String,
      profissao: String,
      telefone: String,
      email: String,
      foto: String,
    },

    /* ===============================
       CLIENTE
    =============================== */

    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    cliente: {
      nome: String,
      telefone: String,
      email: String,
      endereco: String,
    },

    /* ===============================
       ORIGEM
    =============================== */

    origem: {
      type: String,
      enum: ['manual', 'chat'],
      default: 'manual',
    },

    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
    },

    mensagemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mensagem',
      default: null,
    },

    /* ===============================
       SERVIÇOS
    =============================== */

    itens: {
      type: [itemSchema],
      default: [],
    },

    /* ===============================
       VALORES
    =============================== */

    subtotal: {
      type: Number,
      default: 0,
    },

    desconto: {
      type: Number,
      default: 0,
    },

    acrescimo: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      default: 0,
    },

    /* ===============================
       PAGAMENTO
    =============================== */

    formaPagamento: {
      type: String,
      default: '',
    },

    validade: {
      type: Date,
      default: null,
    },

    observacoes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    /* ===============================
       PDF
    =============================== */

    pdf: {
      url: String,
      geradoEm: Date,
      versao: {
        type: Number,
        default: 1,
      },
    },

    /* ===============================
       COMPARTILHAMENTOS
    =============================== */

    compartilhamentos: {
      chat: {
        type: Boolean,
        default: false,
      },

      whatsapp: {
        type: Boolean,
        default: false,
      },

      email: {
        type: Boolean,
        default: false,
      },

      download: {
        type: Boolean,
        default: false,
      },
    },

    /* ===============================
       STATUS
    =============================== */

    status: {
      type: String,
      enum: [
        'rascunho',
        'salvo',
        'compartilhado',
        'cancelado',
      ],
      default: 'rascunho',
      index: true,
    },

    favorito: {
      type: Boolean,
      default: false,
    },

    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    /* ===============================
       APARÊNCIA DO PDF
    =============================== */

    layout: {
      tema: {
        type: String,
        default: 'padrao',
      },

      mostrarFoto: {
        type: Boolean,
        default: true,
      },

      mostrarEndereco: {
        type: Boolean,
        default: false,
      },

      mostrarTelefone: {
        type: Boolean,
        default: true,
      },

      assinaturaFonte: {
        type: String,
        default: 'elegante',
      },
    },
  },
  {
    timestamps: true,
  }
);

/* ===============================
   ÍNDICES
=============================== */

orcamentoSchema.index({
  profissionalId: 1,
  createdAt: -1,
});

orcamentoSchema.index({
  clienteId: 1,
  createdAt: -1,
});

orcamentoSchema.index({
  status: 1,
  ativo: 1,
});

module.exports =
  mongoose.models.Orcamento ||
  mongoose.model('Orcamento', orcamentoSchema);