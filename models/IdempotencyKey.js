// models/IdempotencyKey.js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  empresaId: { type: String, index: true, required: true },
  key: { type: String, index: true, required: true, unique: true },
  lastResponse: { type: Object },
}, { timestamps: true });
export default mongoose.model('IdempotencyKey', schema);
