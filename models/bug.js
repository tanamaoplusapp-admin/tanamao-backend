// backend/models/bug.js
const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    severity: { type: String, enum: ['baixo', 'médio', 'alto', 'crítico'], default: 'médio' },
    status: { type: String, enum: ['aberto', 'triagem', 'em_andamento', 'resolvido', 'fechado'], default: 'aberto' },
    appVersion: { type: String },
    platform: { type: String },
    device: { type: String },
    stack: { type: String },
    meta: { type: Object },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  },
  { timestamps: true }
);

schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Bug || mongoose.model('Bug', schema);
