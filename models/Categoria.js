const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  slug: { type: String, unique: true },
  icone: String,
  ativa: { type: Boolean, default: true }
}, { timestamps: true });

module.exports =
  mongoose.models.Categoria ||
  mongoose.model('Categoria', categoriaSchema);