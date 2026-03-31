// models/ticket.js
const mongoose = require('mongoose');

const Message = new mongoose.Schema(
  {
    from: { type: String, enum: ['user', 'agent', 'system'], default: 'user' },
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },
    userEmail: { type: String, trim: true },
    userId: { type: String, trim: true },
    status: { type: String, enum: ['aberto', 'em_andamento', 'resolvido', 'fechado'], default: 'aberto' },
    messages: { type: [Message], default: [] },
  },
  { timestamps: true }
);

schema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Ticket || mongoose.model('Ticket', schema);
