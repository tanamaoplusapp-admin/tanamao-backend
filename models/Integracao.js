// models/Integracao.js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  empresaId: { type: String, index: true, unique: true },
  provider: { type: String },
  mode: { type: String, enum: ['push','pull','file'], default: 'push' },
  baseUrl: String,
  apiKey: String,
  clientId: String,
  clientSecret: String,
  secret: String, // HMAC secret
  mapping: { type: Object },
  schedule: String,
  lastStatus: { type: Object },
}, { timestamps: true });
export default mongoose.model('Integracao', schema);
