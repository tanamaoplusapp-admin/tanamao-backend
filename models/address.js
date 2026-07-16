const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /* =========================
       ENDEREÇO
    ========================= */

    cep: {
      type: String,
      trim: true,
    },

    // Compatibilidade com telas antigas
    rua: {
      type: String,
      trim: true,
    },

    // Novo padrão
    logradouro: {
      type: String,
      trim: true,
    },

    numero: {
      type: String,
      trim: true,
    },

    complemento: {
      type: String,
      trim: true,
    },

    bairro: {
      type: String,
      trim: true,
    },

    cidade: {
      type: String,
      trim: true,
      index: true,
    },

    estado: {
      type: String,
      trim: true,
    },

    pais: {
      type: String,
      trim: true,
    },

    enderecoCompleto: {
      type: String,
      trim: true,
    },

    /* =========================
       LOCALIZAÇÃO
    ========================= */

    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },

    /* =========================
       ENDEREÇO PRINCIPAL
    ========================= */

    isPrincipal: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Address ||
  mongoose.model('Address', addressSchema);