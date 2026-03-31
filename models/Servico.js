// models/Servico.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

/* =====================================================
   GEOJSON POINT
===================================================== */

const PointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },

    coordinates: {
      type: [Number], // [lng, lat]
      required: true,

      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length === 2 &&
          arr.every((n) => typeof n === 'number'),

        message: 'coordinates deve ser [lng, lat]',
      },
    },
  },
  { _id: false }
);

/* =====================================================
   SCHEMA PRINCIPAL
===================================================== */

const servicoSchema = new Schema(
  {
    /* =============================
       IDENTIFICAÇÃO
    ============================= */

    cliente: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    profissional: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    empresa: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },

    /* =============================
       🔥 NOVA ESTRUTURA (SEM QUEBRAR)
    ============================= */

    categoriaId: {
      type: Schema.Types.ObjectId,
      ref: 'Categoria',
      
    },

    profissaoId: {
      type: Schema.Types.ObjectId,
      ref: 'Profissao',
      
    },
/* =============================
   TIPO DO FLUXO (CHAT)
============================= */

tipoServico: {
  type: String,
  enum: ['normal','orcamento','agendado'],
  default: 'normal',
  index: true,
},
    /* =============================
       LEGADO (MANTIDO)
    ============================= */

    categoria: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    descricao: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    /* =============================
       STATUS DO FLUXO
    ============================= */

    status: {
      type: String,
      enum: [
        'pendente',
        'aceito',
        'em_rota',
        'pago',
        'finalizado',
        'cancelado',
        'expirado',
      ],
      default: 'pendente',
      index: true,
    },

    /* =============================
       URGÊNCIA / SLA
    ============================= */

    urgente: {
      type: Boolean,
      default: false,
      index: true,
    },

    slaExpiraEm: {
      type: Date,
      default: null,
    },

    expirado: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* =============================
       LOCALIZAÇÃO
    ============================= */

    location: {
      type: PointSchema,
      required: true,
      index: '2dsphere',
    },

    professionalLocation: {
      type: PointSchema,
      index: '2dsphere',
    },
 /* =============================
       AGENDA
    ============================= */
dataAgendada:{
type:String
},

horaAgendada:{
type:String
},

valorFinal:{
type:Number
},

    /* =============================
       FINANCEIRO
    ============================= */

/* =============================
   FINANCEIRO
============================= */

price: {
  type: Number,
  min: 0,
},

payment: {
  method: {
    type: String,
    enum: ['Pix', 'Cartao'],
    default: 'Pix',
  },

  txId: {
    type: String,
    trim: true,
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'refunded'],
    default: 'pending',
  },
},
    /* =============================
       CHAT
    ============================= */

    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      index: true,
    },

    /* =============================
       MÉTRICAS
    ============================= */

    respondidoEm: {
      type: Date,
      default: null,
    },

    tempoRespostaSegundos: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { timestamps: true }
);

/* =====================================================
   TRANSIÇÃO DE STATUS
===================================================== */

servicoSchema.methods.canTransitionTo = function (next) {
  const flow = [
    'pendente',
    'aceito',
    'em_rota',
    'pago',
    'finalizado',
  ];

  if (next === 'cancelado' || next === 'expirado') {
    return true;
  }

  const currentIdx = flow.indexOf(this.status);
  const nextIdx = flow.indexOf(next);

  if (currentIdx === -1 || nextIdx === -1) {
    return false;
  }

  return nextIdx >= currentIdx;
};

/* =====================================================
   INDEXES (MELHORADOS)
===================================================== */

servicoSchema.index({ status: 1, expirado: 1 });
servicoSchema.index({ slaExpiraEm: 1 });

// 🔥 NOVOS ÍNDICES PARA ESCALA
servicoSchema.index({ categoriaId: 1 });
servicoSchema.index({ profissaoId: 1 });

/* =====================================================
   EXPORT
===================================================== */

module.exports =
  mongoose.models.Servico ||
  mongoose.model('Servico', servicoSchema);