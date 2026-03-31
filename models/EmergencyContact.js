// models/EmergencyContact.js
const mongoose = require('mongoose');

const EmergencyContactSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  tipo: { type: String, default: 'geral' }, // ex: 'delegacia-mulher', 'conselho-tutelar'
  telefone: { type: String, required: true }, // "190", "(67) 3431-0000"
  descricao: String,

  // Escopo de atendimento
  origem: { type: String, enum: ['municipal', 'estadual', 'nacional'], default: 'municipal' },
  uf: { type: String, uppercase: true, trim: true }, // ex: 'MS' (municipal/estadual)
  cidade: { type: String, trim: true },              // municipal

  // Geo (opcional): só salve se tiver coordinates
  location: {
    type: {
      type: String,
      enum: ['Point'],
      // sem default!
    },
    coordinates: {
      type: [Number], // [lng, lat]
      // sem default!
    },
  },
  raioKm: Number, // raio de cobertura para location

  ativo: { type: Boolean, default: true },
}, { timestamps: true });

EmergencyContactSchema.index({ origem: 1, uf: 1, cidade: 1 });
EmergencyContactSchema.index({ location: '2dsphere' }); // docs sem 'location' não quebram o índice

module.exports = mongoose.model('EmergencyContact', EmergencyContactSchema);
