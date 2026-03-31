// models/KnowledgeArticle.js
const mongoose = require('mongoose');

const kbSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '', trim: true },
    category: { type: String, default: 'Geral', trim: true },
    url: { type: String, trim: true }, // link externo opcional
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

kbSchema.index({ isPublished: 1, updatedAt: -1 });
kbSchema.index({ title: 'text', content: 'text', category: 'text' });

module.exports = mongoose.model('KnowledgeArticle', kbSchema);
