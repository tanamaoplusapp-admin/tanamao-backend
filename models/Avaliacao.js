// models/Avaliacao.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const avaliacaoSchema = new Schema(
  {
    // ===== Alvos possíveis =====
    motorista: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    empresa: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    pedido: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    produto: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },

    // ===== Cliente que avaliou =====
    clienteId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cliente: {
      type: String,
      trim: true,
    },

    // ===== Avaliação =====
    nota: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comentario: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Valida que existe pelo menos um alvo e um cliente
avaliacaoSchema.pre('validate', function (next) {
  if (!this.motorista && !this.empresa && !this.pedido) {
    return next(new Error('Informe motorista, empresa ou pedido.'));
  }
  if (!this.clienteId && !this.cliente) {
    return next(new Error('Informe clienteId ou cliente.'));
  }
  next();
});

// Índices úteis
avaliacaoSchema.index({ motorista: 1, createdAt: -1 });
avaliacaoSchema.index({ empresa: 1, createdAt: -1 });
avaliacaoSchema.index({ pedido: 1, createdAt: -1 });
avaliacaoSchema.index({ nota: 1 });

module.exports = mongoose.model('Avaliacao', avaliacaoSchema);
