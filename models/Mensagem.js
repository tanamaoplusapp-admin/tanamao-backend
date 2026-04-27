// models/Mensagem.js
const mongoose = require('mongoose');

const mensagemSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },

    remetente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /* ================= CONTEÚDO ================= */

    texto: {
      type: String,
      trim: true,
    },

    imagemUrl: {
      type: String,
      trim: true,
    },

    // 🔥 NOVO: localização estruturada (sem quebrar o atual)
    localizacao: {
      latitude: Number,
      longitude: Number,
      expiraEm: Date,
    },

    /* ================= TIPO ================= */

    type: {
      type: String,
      enum: ['text', 'image', 'location', 'system'],
      default: 'text',
      index: true,
    },

    /* ================= CONTROLE ================= */

    lidoPor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mensagem',
    },

    removido: {
      type: Boolean,
      default: false,
    },

    /* ================= DATAS ================= */

    enviadoEm: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= VALIDAÇÕES ================= */

mensagemSchema.pre('validate', function (next) {

  // 🔥 compatibilidade com sistema antigo (prefixo)
  const LOCATION_PREFIX = '[LOCALIZACAO]';

  if (this.texto && this.texto.startsWith(LOCATION_PREFIX)) {
    this.type = 'location';
  }

  if (this.imagemUrl) {
    this.type = 'image';
  }

  if (this.localizacao) {
    this.type = 'location';
  }

  if (this.type !== 'system') {
    const temConteudo =
      this.texto ||
      this.imagemUrl ||
      this.localizacao;

    if (!temConteudo) {
      return next(new Error('Mensagem vazia.'));
    }
  }

  return next();
});

/* ================= ÍNDICES ================= */

mensagemSchema.index({ chatId: 1, enviadoEm: 1 });
mensagemSchema.index({ remetente: 1, enviadoEm: -1 });
mensagemSchema.index({ chatId: 1, _id: 1 });

/* ================= SERIALIZAÇÃO ================= */

mensagemSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Mensagem', mensagemSchema);