const mongoose = require('mongoose');

const IntegrationAccountSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true, required: true },
  provider: { type: String, enum: ['tiny', 'omie'], index: true, required: true },
  enabled: { type: Boolean, default: true, index: true },

  // credenciais
  credentials: {
    apiToken: { type: String },             // Tiny
    appKey: { type: String },               // Omie
    appSecret: { type: String },            // Omie
    oauth: {                                // Se Omie OAuth
      accessToken: String,
      refreshToken: String,
      expiresAt: Date,
      scope: [String],
    },
  },

  // preferências de sync por domínio
  scopes: {
    company: { type: Boolean, default: true },   // dados cadastrais da empresa
    products: { type: Boolean, default: true },  // catálogo
    inventory: { type: Boolean, default: true }, // estoque/saldos
    prices: { type: Boolean, default: true },    // preços
    orders: { type: Boolean, default: true },    // pedidos/vendas
  },

  // estado geral
  status: {
    lastSyncAt: Date,
    lastError: String,
  },
}, { timestamps: true });

IntegrationAccountSchema.index({ companyId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('IntegrationAccount', IntegrationAccountSchema);
