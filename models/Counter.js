const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    /**
     * Nome do contador
     * Ex:
     * orcamento
     * pedido
     * servico
     */
    _id: {
      type: String,
      required: true,
    },

    /**
     * Ano da sequência
     * Ex:
     * 2026
     */
    ano: {
      type: Number,
      required: true,
      index: true,
    },

    /**
     * Último número utilizado
     */
    sequencia: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports =
  mongoose.models.Counter ||
  mongoose.model('Counter', counterSchema);