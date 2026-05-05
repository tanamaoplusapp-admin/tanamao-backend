// models/Chat.js
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

    /*
      VÍNCULO OFICIAL COM SERVICE

      Regra Tanamão+:
      1 service = 1 chat.

      Mantemos default null para não quebrar chats antigos
      criados antes do vínculo obrigatório com serviço.
    */
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
      index: true,
    },

    /*
      Texto da última mensagem.
      Usado nas listas de conversas.
    */
    ultimoTexto: {
      type: String,
      default: '',
      trim: true,
    },

    /*
      Último usuário que enviou mensagem.
      Compatível com o chatController, que já atualiza:
      ultimoRemetente: remetenteId
    */
    ultimoRemetente: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    /*
      Usado pelos controllers para ordenar conversas recentes.
    */
    atualizadoEm: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* =========================================================
   VIRTUALS
========================================================= */

/**
 * Compatibilidade de leitura:
 * Algumas partes antigas podem chamar servicoId.
 * O campo real salvo no banco continua sendo serviceId.
 */
chatSchema.virtual('servicoId').get(function () {
  return this.serviceId;
});

/**
 * Virtual para acessar mensagens via coleção separada Mensagem.
 */
chatSchema.virtual('mensagens', {
  ref: 'Mensagem',
  localField: '_id',
  foreignField: 'chatId',
  justOne: false,
  options: { sort: { enviadoEm: 1, createdAt: 1 } },
});

/* =========================================================
   ÍNDICES
========================================================= */

/**
 * Garantia:
 * 1 service = 1 chat.
 *
 * partialFilterExpression evita quebrar chats antigos
 * ou chats sem serviceId.
 */
chatSchema.index(
  { serviceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      serviceId: { $exists: true, $ne: null },
    },
  }
);

/**
 * Performance para listar chats do usuário por atividade recente.
 */
chatSchema.index({
  participantes: 1,
  atualizadoEm: -1,
});

/**
 * Performance para telas/listagens recentes.
 */
chatSchema.index({
  atualizadoEm: -1,
});

/* =========================================================
   MIDDLEWARES
========================================================= */

/**
 * Normaliza participantes:
 * - remove duplicados
 * - ordena IDs
 *
 * Isso evita criar chats duplicados com os mesmos participantes
 * em ordem diferente.
 */
chatSchema.pre('validate', function (next) {
  if (Array.isArray(this.participantes)) {
    const uniq = [
      ...new Set(
        this.participantes
          .filter(Boolean)
          .map((id) => id.toString())
      ),
    ];

    this.participantes = uniq.sort();
  }

  next();
});

/**
 * Sempre atualiza atividade ao salvar o documento.
 */
chatSchema.pre('save', function (next) {
  this.atualizadoEm = new Date();
  next();
});

/* =========================================================
   EXPORT
========================================================= */

module.exports = mongoose.model('Chat', chatSchema);