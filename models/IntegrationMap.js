const mongoose = require('mongoose');

const IntegrationMapSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true, required: true },
  provider: { type: String, enum: ['tiny', 'omie'], index: true, required: true },
  domain: { type: String, enum: ['company','product','inventory','price','order','customer'], index: true, required: true },
  localId: { type: String, index: true, required: true },     // ex: _id do produto
  providerId: { type: String, index: true, required: true },  // ex: id no ERP
  extra: { type: Object }, // guarda campos úteis p/ idempotência
}, { timestamps: true });

IntegrationMapSchema.index({ companyId: 1, provider: 1, domain: 1, localId: 1 }, { unique: true });
IntegrationMapSchema.index({ companyId: 1, provider: 1, domain: 1, providerId: 1 }, { unique: true });

module.exports = mongoose.model('IntegrationMap', IntegrationMapSchema);
