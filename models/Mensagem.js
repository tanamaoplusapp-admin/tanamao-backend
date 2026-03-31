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

    // Conteúdo
    texto: { type: String, trim: true },
    imagemUrl: { type: String, trim: true },

    // Tipo de mensagem (ajuda no front)
    type: {
      type: String,
      enum: ['text', 'image', 'system'],
      default: 'text',
    },

    // Recursos para evolução (não quebram nada existente)
    lidoPor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // quem já leu
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Mensagem' }, // resposta a outra msg
    removido: { type: Boolean, default: false }, // soft delete

    // Datas
    enviadoEm: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

/* --------------------- Validações/normalizações --------------------- */
// exige ao menos texto OU imagem (exceto "system")
mensagemSchema.pre('validate', function (next) {
  if (this.type !== 'system' && !this.texto && !this.imagemUrl) {
    return next(new Error('A mensagem precisa conter texto ou imagem.'));
  }
  // define tipo automaticamente se não vier
  if (!this.type) {
    this.type = this.imagemUrl ? 'image' : 'text';
  }
  return next();
});

/* --------------------------- Índices úteis --------------------------- */
// Ordenação rápida por chat e horário
mensagemSchema.index({ chatId: 1, enviadoEm: 1 });
// Listagens e estatísticas por remetente
mensagemSchema.index({ remetente: 1, enviadoEm: -1 });
// Acesso eficiente ao histórico num chat
mensagemSchema.index({ chatId: 1, _id: 1 });

/* ---------------------- Serialização segura ------------------------- */
mensagemSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Mensagem', mensagemSchema);
