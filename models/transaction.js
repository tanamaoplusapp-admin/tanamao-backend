// models/Transaction.js

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    description: {
      type: String,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: [
        'service_payment',
        'commission_payment',
        'monthly_fee',
        'refund',
      ],
      required: true,
    },

    role: {
      type: String,
      enum: ['cliente', 'profissional', 'empresa', 'motorista'],
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['pix', 'card', 'cash', 'manual'],
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },

    paymentId: String,

    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });

module.exports =
  mongoose.models.Transaction ||
  mongoose.model('Transaction', schema);