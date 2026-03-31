const mongoose = require('mongoose');

const OfertaSchema = new mongoose.Schema(
  {
    profissionalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profissional',
      required: true,
      index: true,
    },

    titulo: {
      type: String,
      required: true,
      trim: true,
    },

    descricao: {
      type: String,
      required: true,
      trim: true,
    },

    preco: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['ativa', 'pausada', 'excluida'],
      default: 'ativa',
    },

    visivelNoPerfil: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Oferta', OfertaSchema);