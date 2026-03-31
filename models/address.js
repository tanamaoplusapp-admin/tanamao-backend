const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  cep: String,
  rua: String,
  numero: String,
  complemento: String,
  bairro: String,
  cidade: String,
  estado: String,

  isPrincipal: {
    type: Boolean,
    default: true,
  }

}, { timestamps: true });

module.exports =
  mongoose.models.Address ||
  mongoose.model('Address', addressSchema);