const mongoose = require('mongoose');

const AgendaSchema = new mongoose.Schema({

  profissionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // 🔥 CLIENTE VINCULADO (quando existir conta no app)
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

  // 🔥 TELEFONE NORMALIZADO (chave de busca)
  clienteTelefone: {
    type: String,
    trim: true,
    index: true, // 🔥 importante para busca rápida
  },

  // 🔥 NOVO: TELEFONE ORIGINAL (opcional, só UX)
  clienteTelefoneOriginal: {
    type: String,
    trim: true,
  },

  // 🔥 manter compatibilidade (SEM QUEBRAR)
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

  // 🔥 PREPARAÇÃO FUTURA (NÃO QUEBRA NADA)
  dataHoraInicio: {
    type: Date,
    index: true,
  },

  dataHoraFim: {
    type: Date,
  },

  // 🔥 status mais preparado
  status: {
    type: String,
    enum: ['ativo', 'cancelado', 'finalizado'],
    default: 'ativo',
    index: true,
  },

}, {
  timestamps: true,
});


// 🔥 ÍNDICE PRINCIPAL (consulta padrão)
AgendaSchema.index({
  profissionalId: 1,
  data: 1,
  horaInicio: 1,
});

// 🔥 CLIENTE (para agenda do cliente)
AgendaSchema.index({
  clienteId: 1,
  data: 1,
  horaInicio: 1,
});

// 🔥 BUSCA POR TELEFONE (importante pra fronteira)
AgendaSchema.index({
  clienteTelefone: 1,
});

module.exports = mongoose.model('Agenda', AgendaSchema);