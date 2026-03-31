// models/review.js
const mongoose = require('mongoose');

const { Schema, Types } = mongoose;

/**
 * Review genérico para profissionais/motoristas (e compat com futuras entidades).
 * - Mantém os nomes esperados no app (clientId, professionalId, rating, comment)
 * - Usa refPath para permitir que professionalId aponte para Driver | Professional | User
 * - Inclui virtuais "nota" e "comentario" p/ compatibilidade com trechos em PT-BR
 */
const reviewSchema = new Schema(
  {
    // quem avaliou
    clientId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    /**
     * alvo da avaliação
     * - por padrão, apontamos para 'Driver'
     * - pode ser 'Professional' ou 'User' (quando profissionais moram em User)
     */
    professionalId: {
      type: Types.ObjectId,
      required: true,
      index: true,
      refPath: 'professionalModel',
    },
    professionalModel: {
      type: String,
      enum: ['Driver', 'Professional', 'User'],
      default: 'Driver',
      index: true,
    },

    // opcional: vincular a um pedido para evitar avaliações “soltas”
    orderId: { type: Types.ObjectId, ref: 'Order', index: true },

    // avaliação em si
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

/* -------------------- Índices úteis -------------------- */
reviewSchema.index({ professionalId: 1, professionalModel: 1, createdAt: -1 });
reviewSchema.index({ clientId: 1, professionalId: 1, professionalModel: 1 });

/* -------------------- Virtuais de compatibilidade -------------------- */
// Alguns trechos do app/back podem usar "nota" / "comentario"
reviewSchema
  .virtual('nota')
  .get(function () {
    return this.rating;
  })
  .set(function (v) {
    const n = Number(v);
    if (Number.isFinite(n)) this.rating = Math.min(5, Math.max(1, n));
  });

reviewSchema
  .virtual('comentario')
  .get(function () {
    return this.comment;
  })
  .set(function (v) {
    this.comment = v;
  });

/* -------------------- Serialização -------------------- */
reviewSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Review', reviewSchema);
