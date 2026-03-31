// models/SupportTicket.js
const mongoose = require('mongoose');

const msgSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['user', 'agent'], required: true },
    text: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    userEmail: { type: String, trim: true, lowercase: true },
    priority: {
      type: String,
      enum: ['baixa', 'média', 'alta', 'urgente'],
      default: 'média',
    },
    status: {
      type: String,
      enum: ['aberto', 'andamento', 'fechado'],
      default: 'aberto',
    },

    // vínculo com usuário/empresa (quando o app envia autenticado)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa' },

    messages: { type: [msgSchema], default: [] },

    // metadados opcionais
    tags: [{ type: String, trim: true }],
    source: { type: String, default: 'app' }, // app, web, email, etc
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ userEmail: 1, createdAt: -1 });
ticketSchema.index({ subject: 'text', tags: 'text' });

module.exports = mongoose.model('SupportTicket', ticketSchema);
