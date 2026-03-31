const mongoose = require('mongoose');

const profissaoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  categoriaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoria',
    required: true
  },
  ativa: { type: Boolean, default: true }
}, { timestamps: true });

module.exports =
  mongoose.models.Profissao ||
  mongoose.model('Profissao', profissaoSchema);