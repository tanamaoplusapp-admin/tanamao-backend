// models/driver.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;
const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

const driverSchema = new Schema(
  {
    // Identificação
    name: { type: String, required: [true, 'O nome é obrigatório'], trim: true },
    email: {
      type: String,
      required: [true, 'O e-mail é obrigatório'],
      unique: true,      // ✅ unique/index no campo
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'A senha é obrigatória'],
      select: false,
    },

    // Documentos
    cpf: {
      type: String,
      required: [true, 'O CPF é obrigatório'],
      unique: true,      // ✅ unique/index no campo
      trim: true,
      index: true,
      set: (v) => {
        const d = onlyDigits(v);
        return d || undefined;
      },
    },
    cnhNumber: { type: String, trim: true },
    cnhCategory: { type: String, trim: true },
    cnhExpiresAt: { type: Date },
    cnhStatus: { type: String, trim: true },
    fotoPerfil: { type: String, trim: true },

    // Contato / Endereço
    phone: {
      type: String,
      required: [true, 'O telefone é obrigatório'],
      set: (v) => {
        const d = onlyDigits(v);
        return d || undefined;
      },
    },
    address: { type: String, trim: true },
    cidade: { type: String, trim: true },
    uf: { type: String, trim: true, uppercase: true },

    // Veículo
    vehicleType: { type: String, enum: ['carro', 'moto', 'van', 'outro'], default: 'carro' },
    plateNumber: { type: String, trim: true, uppercase: true, index: true }, // ✅ index no campo
    vehicleModel: { type: String, trim: true },
    vehicleColor: { type: String, trim: true },

    // Localização / Disponibilidade
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
    available: { type: Boolean, default: false },
    lastLocationAt: { type: Date },

    // Recebimento
    recebimentoPreferido: { type: String, enum: ['pix', 'conta'], default: 'pix' },
    pixKey: { type: String, trim: true },
    dadosBancarios: {
      banco: { type: String },
      agencia: { type: String },
      conta: { type: String },
      tipoConta: { type: String },
      titular: { type: String },
      documentoTitular: {
        type: String,
        set: (v) => {
          const d = onlyDigits(v);
          return d || undefined;
        },
      },
    },

    // Cobrança mensalidade
    billing: {
      consent: { type: Boolean, default: false },
      monthlyFee: { type: Number, default: 129.99 },
      status: { type: String, enum: ['ativo', 'inadimplente', 'isento'], default: 'ativo' },
      lastChargedAt: { type: Date },
      nextChargeAt: { type: Date },
    },
    mp: {
      customerId: { type: String, index: true },
      defaultCardId: { type: String },
    },

    // Avaliações
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // Flags
    status: { type: String, enum: ['pendente', 'aprovado', 'reprovado'], default: 'pendente' },
    approvedAt: { type: Date },
    isVerified: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* -------------------- Virtuais / Aliases -------------------- */
driverSchema
  .virtual('nome')
  .get(function () { return this.name; })
  .set(function (v) { this.name = v; });

/* -------------------- Índices -------------------- */
// ✅ Mantemos apenas o 2dsphere (nada de email/cpf/plateNumber duplicado aqui)
driverSchema.index({ location: '2dsphere' });

/* -------------------- Hooks -------------------- */
driverSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const s = this.password || '';
    if (!/^\$2[aby]\$/.test(s)) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(s, salt);
    }
  }
  return next();
});

/* -------------------- Métodos -------------------- */
driverSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(String(plain || ''), this.password || '');
};

driverSchema.methods.applyRating = function ({ stars }) {
  const s = Number(stars);
  if (!Number.isFinite(s) || s <= 0) return;
  const total = (this.ratingAvg * this.ratingCount + s);
  this.ratingCount += 1;
  this.ratingAvg = +(total / this.ratingCount).toFixed(2);
};

/* -------------------- Serialização -------------------- */
driverSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id?.toString?.() || ret._id;
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Driver', driverSchema);
