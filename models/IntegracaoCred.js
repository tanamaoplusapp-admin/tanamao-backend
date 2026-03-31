const mongoose = require('mongoose');

const IntegracaoCredSchema = new mongoose.Schema(
  {
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', index: true, required: true },
    provider: { type: String, index: true, required: true }, // 'omie', 'tiny', 'bling', 'custom'
    // OAuth
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
    scope: String,
    // API key / custom
    apiKey: String,
    baseUrl: String,
    // auditoria
    meta: Object,
    lastSyncAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('IntegracaoCred', IntegracaoCredSchema);
