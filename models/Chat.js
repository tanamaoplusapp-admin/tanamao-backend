// models/chat.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const chatSchema = new Schema(
  {
    participantes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: [
        (arr) => Array.isArray(arr) && arr.length >= 2,
        'Um chat precisa ter pelo menos 2 participantes',
      ],
      index: true,
    },

    // 🔥 NOVO: vínculo com service
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: null, // importante pra não quebrar chats antigos
      index: true,
    },

    // texto da última mensagem (denormalizado)
    ultimoTexto: { type: String, default: '' },

    // usado pelos controllers para ordenar recentes
    atualizadoEm: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Virtual para acessar mensagens via coleção separada `Mensagem`
 */
chatSchema.virtual('mensagens', {
  ref: 'Mensagem',
  localField: '_id',
  foreignField: 'chatId',
  justOne: false,
  options: { sort: { enviadoEm: 1 } },
});

/**
 * 🔥 GARANTIA DE REGRA:
 * 1 service = 1 chat
 */
chatSchema.index(
  { serviceId: 1 },
  {
    unique: true,
    partialFilterExpression: { serviceId: { $exists: true, $ne: null } },
  }
);

// Mantém os participantes normalizados
chatSchema.pre('validate', function (next) {
  if (Array.isArray(this.participantes)) {
    const uniq = [...new Set(this.participantes.map((id) => id.toString()))];
    this.participantes = uniq.sort();
  }
  next();
});

// Sempre atualiza atividade
chatSchema.pre('save', function (next) {
  this.atualizadoEm = new Date();
  next();
});

// Índice composto (performance)
chatSchema.index({ participantes: 1, atualizadoEm: -1 });

module.exports = mongoose.model('Chat', chatSchema);