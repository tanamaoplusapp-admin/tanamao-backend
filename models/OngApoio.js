const mongoose = require('mongoose');

const OngApoioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  categorias: [String], // ['mulheres','indigenas','animais',...]
  descricao: String,
  site: String,
  telefone: String,
  logoUrl: String,

  pix: {
    tipo: { type: String, enum: ['email','cpf','cnpj','telefone','aleatoria'], required: true },
    chave: { type: String, required: true },
    copiaECola: String,
    qrCodeImageUrl: String,
  },

  ativo: { type: Boolean, default: false },
}, { timestamps: true });

OngApoioSchema.index({ nome: 'text', categorias: 1 });

module.exports = mongoose.model('OngApoio', OngApoioSchema);
