const mongoose = require('mongoose');

const AgendaSchema = new mongoose.Schema({

  profissionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // 🔥 NOVO CAMPO
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // importante pra não quebrar fluxo atual
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

  status: {
    type: String,
    enum: ['ativo', 'cancelado'],
    default: 'ativo',
  },

}, {
  timestamps: true,
});


// 🔥 ÍNDICE MELHORADO (AGORA COM CLIENTE)
AgendaSchema.index({
  profissionalId: 1,
  clienteId: 1,
  data: 1,
  horaInicio: 1,
});

module.exports = mongoose.model('Agenda', AgendaSchema);