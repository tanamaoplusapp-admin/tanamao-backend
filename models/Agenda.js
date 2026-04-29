const mongoose = require('mongoose');

const AgendaSchema = new mongoose.Schema(
  {
    profissionalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true,
    },

    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
      index: true,
    },

    clienteNome: {
      type: String,
      required: true,
      trim: true,
    },

    clienteTelefone: {
      type: String,
      trim: true,
      index: true,
    },

    clienteTelefoneOriginal: {
      type: String,
      trim: true,
    },

    categoria: {
      type: String,
      trim: true,
      default: 'Agendamento',
      index: true,
    },

    servicoNome: {
      type: String,
      trim: true,
    },

    data: {
      type: String,
      required: true,
      index: true,
    },

    horaInicio: {
      type: String,
      required: true,
    },

    horaFim: {
      type: String,
      required: true,
    },

    dataHoraInicio: {
      type: Date,
      index: true,
    },

    dataHoraFim: {
      type: Date,
    },

    status: {
      type: String,
      enum: ['ativo', 'cancelado', 'finalizado'],
      default: 'ativo',
      index: true,
    },

    conviteToken: {
      type: String,
      default: null,
      index: true,
    },

    conviteExpiraEm: {
      type: Date,
      default: null,
      index: true,
    },

    conviteStatus: {
      type: String,
      enum: ['pendente', 'aceito', 'expirado', 'cancelado'],
      default: 'pendente',
      index: true,
    },

    conviteAceitoEm: {
      type: Date,
      default: null,
    },

    conviteEnviadoEm: {
      type: Date,
      default: null,
    },

    origem: {
      type: String,
      enum: ['manual', 'contato_telefone', 'service', 'cliente_app'],
      default: 'manual',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AgendaSchema.index({
  profissionalId: 1,
  data: 1,
  horaInicio: 1,
});

AgendaSchema.index({
  clienteId: 1,
  data: 1,
  horaInicio: 1,
});

AgendaSchema.index({
  clienteTelefone: 1,
});

AgendaSchema.index({
  categoria: 1,
});

AgendaSchema.index(
  { conviteToken: 1 },
  {
    unique: true,
    partialFilterExpression: {
      conviteToken: { $type: 'string' },
    },
  }
);

AgendaSchema.index({
  profissionalId: 1,
  conviteStatus: 1,
  createdAt: -1,
});

AgendaSchema.index({
  clienteId: 1,
  conviteStatus: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.Agenda ||
  mongoose.model('Agenda', AgendaSchema);