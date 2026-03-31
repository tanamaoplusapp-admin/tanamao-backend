const mongoose = require('mongoose');

const AuditEventSchema = new mongoose.Schema({
  type: { type: String, required: true },          // ex.: order.created, payment.approved
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: false },
  sessionId: { type: String },
  correlationId: { type: String },
  payload: { type: Object, default: {} },
}, { timestamps: true });

// Index para listagem recente
AuditEventSchema.index({ createdAt: -1 });

// Index para consultas por tipo
AuditEventSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('AuditEvent', AuditEventSchema);
