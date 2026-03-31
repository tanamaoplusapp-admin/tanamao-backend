// models/product.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const isUrlLike = (s) =>
  typeof s === 'string' &&
  (/^https?:\/\//i.test(s.trim()) || /^data:image\//i.test(s.trim()));

const CaracteristicaSchema = new Schema(
  { chave: { type: String, trim: true }, valor: { type: String, trim: true } },
  { _id: false }
);

const productSchema = new Schema(
  {
    // Básico
    name: { type: String, required: true, trim: true, minlength: 2, index: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '', index: true },
    brand: { type: String, trim: true, default: '' },

    // Preço/estoque
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },

    // Mídia
    images: { type: [String], default: [] },

    // IDs externos p/ integrações
    externalId: { type: String, index: true },

    // Empresa dona do produto
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },

    // Extras estruturados
    caracteristicas: { type: [CaracteristicaSchema], default: [] },
    attributes: { type: Map, of: String, default: undefined },

    // Campo derivado p/ busca
    searchBlob: { type: String, default: '' },
  },
  { timestamps: true }
);

/* -------- Virtuais compat -------- */
productSchema
  .virtual('nome')
  .get(function () { return this.name; })
  .set(function (v) { this.name = v; });

productSchema
  .virtual('preco')
  .get(function () { return this.price; })
  .set(function (v) { this.price = toNumber(v); });

productSchema
  .virtual('imagem')
  .get(function () {
    return Array.isArray(this.images) && this.images.length ? this.images[0] : null;
  });

/* -------- Sanitização -------- */
productSchema.pre('validate', function (next) {
  if (Array.isArray(this.images)) {
    this.images = this.images
      .map((x) => (typeof x === 'number' ? String(x) : x))
      .filter(isUrlLike);
  } else {
    this.images = [];
  }
  next();
});

productSchema.pre('save', function (next) {
  if (this.price !== undefined) this.price = toNumber(this.price) ?? this.price;
  if (this.stock !== undefined) this.stock = Number.isFinite(+this.stock) ? +this.stock : this.stock;

  const parts = [this.name, this.brand, this.category, this.description];
  if (Array.isArray(this.caracteristicas)) {
    this.caracteristicas.forEach((c) => {
      if (!c) return;
      if (c.chave) parts.push(String(c.chave));
      if (c.valor) parts.push(String(c.valor));
    });
  }
  if (this.attributes && this.attributes.size) {
    for (const [k, v] of this.attributes.entries()) {
      if (k) parts.push(String(k));
      if (v) parts.push(String(v));
    }
  }

  this.searchBlob = parts
    .filter(Boolean)
    .map((s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .join(' ')
    .toLowerCase();

  next();
});

/* -------- Índices -------- */
productSchema.index(
  { name: 'text', description: 'text', brand: 'text', category: 'text', searchBlob: 'text' },
  { name: 'product_text_all' }
);
productSchema.index({ category: 1, price: 1 });
productSchema.index({ company: 1, isActive: 1 });
productSchema.index({ company: 1, externalId: 1 }, { unique: false });

/* -------- Serialização -------- */
productSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    // Garante que 'imagem' aparece mesmo em .lean() serializado manualmente
    if (!ret.imagem) {
      ret.imagem = Array.isArray(ret.images) && ret.images.length ? ret.images[0] : null;
    }
    return ret;
  },
});

module.exports = mongoose.model('Product', productSchema);
