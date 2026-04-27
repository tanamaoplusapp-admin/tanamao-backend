// models/Avaliacao.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const avaliacaoSchema = new Schema(
  {
    // ===== Alvos legados =====
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

    // ===== Prestador / Profissional =====

    // Perfil profissional, quando existir model Profissional separado
    profissionalId: {
      type: Schema.Types.ObjectId,
      ref: 'Profissional',
      index: true,
    },

    // User do profissional/prestador
    profissionalUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Compatibilidade com serviços que salvam o profissional neste campo
    profissional: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Legado/compatibilidade
    prestadorId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    // ===== Cliente que avaliou =====
    clienteId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Mantido por compatibilidade com registros antigos
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

    // ===== Origem / tipo =====
    origem: {
      type: String,
      enum: ['motorista', 'empresa', 'pedido', 'profissional', 'servico'],
      default: 'pedido',
      index: true,
    },
  },
  { timestamps: true }
);

// Valida que existe pelo menos um alvo e um cliente
avaliacaoSchema.pre('validate', function (next) {
  const temAlvo =
    this.motorista ||
    this.empresa ||
    this.pedido ||
    this.produto ||
    this.profissionalId ||
    this.profissionalUserId ||
    this.profissional ||
    this.prestadorId;

  if (!temAlvo) {
    return next(
      new Error(
        'Informe motorista, empresa, pedido, produto ou profissional.'
      )
    );
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
avaliacaoSchema.index({ produto: 1, createdAt: -1 });
avaliacaoSchema.index({ profissionalId: 1, createdAt: -1 });
avaliacaoSchema.index({ profissionalUserId: 1, createdAt: -1 });
avaliacaoSchema.index({ profissional: 1, createdAt: -1 });
avaliacaoSchema.index({ prestadorId: 1, createdAt: -1 });
avaliacaoSchema.index({ clienteId: 1, createdAt: -1 });
avaliacaoSchema.index({ nota: 1 });

module.exports = mongoose.model('Avaliacao', avaliacaoSchema);