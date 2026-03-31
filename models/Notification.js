const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: [

        // TIPOS ANTIGOS (mantidos)
        'NOVA_SOLICITACAO',
        'SERVICO_CANCELADO',
        'SERVICO_PAGO',
        'NOVA_MENSAGEM',

        // NOVO PADRÃO TANAMÃO+
        'CHAT_MESSAGE',
        'NOVO_SERVICO',
        'SERVICO_ACEITO',
        'PAGAMENTO_RECEBIDO'

      ],
      index: true,
    },

    urgente: {
      type: Boolean,
      default: false,
      index: true,
    },

    relatedId: {
      type: mongoose.Types.ObjectId,
      index: true,
    },

    payload: {
      type: Object,
      default: {},
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);