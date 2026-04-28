const mongoose = require('mongoose');

const AgendaSchema = new mongoose.Schema({

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

  // 🔥 profissão/categoria exibida para o cliente
  categoria: {
    type: String,
    trim: true,
    default: 'Agendamento',
    index: true,
  },

  // 🔥 opcional: nome do serviço, caso queira diferenciar no futuro
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

}, {
  timestamps: true,
});

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

module.exports = mongoose.model('Agenda', AgendaSchema);