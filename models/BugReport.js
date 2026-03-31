// models/BugReport.js
const mongoose = require('mongoose');

const bugSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    severity: { type: String, enum: ['baixa', 'média', 'alta', 'crítico'], default: 'média' },
    status:   { type: String, enum: ['aberto', 'triagem', 'andamento', 'resolvido'], default: 'aberto' },

    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa' },

    // contexto opcional
    appVersion: { type: String, trim: true },
    platform:   { type: String, trim: true }, // ios/android/web
    device:     { type: String, trim: true },
    stack:      { type: String, trim: true },
    meta:       { type: Object, default: {} },
  },
  { timestamps: true }
);

bugSchema.index({ status: 1, createdAt: -1 });
bugSchema.index({ severity: 1, createdAt: -1 });
bugSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('BugReport', bugSchema);
