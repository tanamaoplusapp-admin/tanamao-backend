// models/company.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// util local: mantém apenas dígitos
const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

const companySchema = new mongoose.Schema(
  {
    // Identificação
    nome: { type: String, required: true, trim: true, index: true },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,   // ✅ unique/index no campo (não duplicar via schema.index)
      index: true,
    },

    // senha: fora dos selects por segurança; hash automático no pre('save')
    senha: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    // Documentos
    cnpj: {
      type: String,
      required: true,
      unique: true,   // ✅ unique/index no campo (não duplicar via schema.index)
      index: true,
      set: (v) => {
        const d = onlyDigits(v);
        return d || undefined;
      },
    },

    // opcional (algumas empresas usam CPF na criação e migram depois)
    cpf: {
      type: String,
      set: (v) => {
        const d = onlyDigits(v);
        return d || undefined;
      },
    },

    telefone: {
      type: String,
      required: true,
      set: (v) => {
        const d = onlyDigits(v);
        return d || undefined;
      },
    },

    /* ---------------- Endereço (campos reais) ---------------- */
    cep:         { type: String, trim: true, set: (v) => onlyDigits(v) || undefined },
    logradouro:  { type: String, trim: true }, // rua/avenida
    numero:      { type: String, trim: true },
    complemento: { type: String, trim: true },
    bairro:      { type: String, trim: true },

    cidade: { type: String, required: true, trim: true },

    // use "uf" internamente; ofereça "estado" como alias/virtual
    uf: { type: String, required: true, trim: true, uppercase: true },

    // Mantemos "endereco" (string) para compatibilidade com partes antigas do app.
    endereco: { type: String, trim: true },

    // GeoJSON p/ busca por proximidade (lng, lat)
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },

    // Dados econômicos
    faturamentoAnual: { type: Number, default: 0 },
    capitalSocial: { type: Number, default: 0 },

    // Porte (original = declarado, normalizado = calculado/ajustado)
    porteOriginal: {
      type: String,
      enum: ['mei', 'pequena', 'media', 'grande', null],
      default: null,
    },
    porteEmpresa: {
      type: String,
      enum: ['pequena', 'media', 'grande'],
      required: true,
      default: 'pequena',
      index: true,
    },

    // Mercado Pago
    collector_id: { type: String, index: true },

    // Catálogo
    categoria: { type: String, trim: true },
    imagens: [String],
    produtos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    // Plano/flags úteis
    plano: { type: String, enum: ['basic', 'pro', 'enterprise'], default: 'basic' },
    ativo: { type: Boolean, default: true },

    // Vínculos e flags
    isVerified: { type: Boolean, default: true },
    user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/* -------- Aliases / Virtuais -------- */
companySchema
  .virtual('estado')
  .get(function () { return this.uf; })
  .set(function (v) { this.uf = (v || '').toString().trim().toUpperCase(); });

companySchema
  .virtual('enderecoObj')
  .get(function () {
    return {
      cep: this.cep || null,
      logradouro: this.logradouro || (this.endereco || null),
      numero: this.numero || null,
      complemento: this.complemento || null,
      bairro: this.bairro || null,
      cidade: this.cidade || null,
      estado: this.uf || null,
    };
  })
  .set(function (v) {
    if (!v || typeof v !== 'object') return;
    if (v.cep)         this.cep = onlyDigits(v.cep);
    if (v.logradouro)  this.logradouro = String(v.logradouro).trim();
    if (v.rua && !v.logradouro) this.logradouro = String(v.rua).trim();
    if (v.numero)      this.numero = String(v.numero).trim();
    if (v.complemento) this.complemento = String(v.complemento).trim();
    if (v.bairro)      this.bairro = String(v.bairro).trim();
    if (v.cidade)      this.cidade = String(v.cidade).trim();
    if (v.estado || v.uf) this.uf = String(v.estado || v.uf).trim().toUpperCase();
  });

/* -------- Índices -------- */
// ✅ Mantemos apenas os adicionais (nada de email/cnpj duplicado aqui)
companySchema.index({ location: '2dsphere' });
companySchema.index({ nome: 'text', cidade: 'text', bairro: 'text' });

/* -------- Hooks -------- */
companySchema.pre('save', async function (next) {
  if (this.isModified('senha')) {
    const s = this.senha || '';
    if (!/^\$2[aby]\$/.test(s)) {
      const salt = await bcrypt.genSalt(10);
      this.senha = await bcrypt.hash(s, salt);
    }
  }

  if (!this.endereco) {
    const partes = [
      this.logradouro,
      this.numero ? `, ${this.numero}` : null,
      this.bairro ? ` - ${this.bairro}` : null,
      this.cidade ? `, ${this.cidade}` : null,
      this.uf ? ` - ${this.uf}` : null,
      this.cep ? `, CEP ${this.cep}` : null,
    ].filter(Boolean);
    if (partes.length) this.endereco = partes.join('');
  }

  next();
});

/* -------- Serialização -------- */
companySchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.senha;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Company', companySchema);
