// models/Promocao.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const promocaoSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },

    originalPrice: { type: Number, required: true, min: 0 },
    promoPrice: { type: Number, required: true, min: 0 },

    validUntil: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// validações
promocaoSchema.pre('validate', function (next) {
  if (this.promoPrice >= this.originalPrice) {
    return next(new Error('O preço promocional deve ser menor que o original.'));
  }
  next();
});

// virtual: desconto %
promocaoSchema.virtual('discountPercent').get(function () {
  if (!this.originalPrice) return 0;
  return Math.round((1 - this.promoPrice / this.originalPrice) * 100);
});

promocaoSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

promocaoSchema.index({ company: 1, product: 1, isActive: 1 });

module.exports = mongoose.model('Promocao', promocaoSchema);
