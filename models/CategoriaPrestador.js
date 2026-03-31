const mongoose = require('mongoose');

/**
 * Categoria de Prestador
 * Controlada exclusivamente pelo Admin
 * Não remove nem interfere em nenhuma estrutura existente
 */

const categoriaPrestadorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    ordem: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

/**
 * Garante que o slug sempre fique padronizado
 */
categoriaPrestadorSchema.pre('validate', function (next) {
  if (this.slug) {
    this.slug = this.slug
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
  next();
});

module.exports =
  mongoose.models.CategoriaPrestador ||
  mongoose.model('CategoriaPrestador', categoriaPrestadorSchema);