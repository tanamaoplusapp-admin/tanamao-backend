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
        'PAGAMENTO_RECEBIDO',

        // NOVOS TIPOS ÚTEIS PARA EVOLUÇÃO
        'AGENDAMENTO_CRIADO',
        'AGENDAMENTO_CONFIRMADO',
        'AGENDAMENTO_CANCELADO',
        'ORCAMENTO_RECEBIDO',
        'ORCAMENTO_ACEITO',
        'ORCAMENTO_RECUSADO',
      ],
      index: true,
    },

    // Título curto da notificação
    title: {
      type: String,
      default: '',
      trim: true,
    },

    // Mensagem principal exibida na tela/push
    message: {
      type: String,
      default: '',
      trim: true,
    },

    urgente: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Campo genérico legado/relacional
    relatedId: {
      type: mongoose.Types.ObjectId,
      default: null,
      index: true,
    },

    // Navegação futura / deep link interno
    chatId: {
      type: mongoose.Types.ObjectId,
      default: null,
      index: true,
    },

    servicoId: {
      type: mongoose.Types.ObjectId,
      default: null,
      index: true,
    },

    agendamentoId: {
      type: mongoose.Types.ObjectId,
      default: null,
      index: true,
    },

    // Metadados flexíveis para push e tela
    payload: {
      type: Object,
      default: {},
    },

    // Controle de leitura no app
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Opcional: rastrear envio de push
    pushSent: {
      type: Boolean,
      default: false,
    },

    pushSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);