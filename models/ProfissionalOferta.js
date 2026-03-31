// models/ProfissionalOferta.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ofertaSchema = new Schema(
  {
    profissional: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    titulo: { type: String, required: true, trim: true, maxlength: 120 },
    descricao: { type: String, required: true, trim: true, maxlength: 4000 },
    preco: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['ativa', 'inativa'], default: 'ativa', index: true },
  },
  { timestamps: true }
);

ofertaSchema.index({ profissional: 1, status: 1, createdAt: -1 });

ofertaSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ProfissionalOferta', ofertaSchema);
