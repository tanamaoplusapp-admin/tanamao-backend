// backend/models/Motorista.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// mantém apenas dígitos
const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');
// placa em maiúsculas, sem espaços extras
const normalizePlate = (s) => String(s || '').trim().toUpperCase();

const motoristaSchema = new mongoose.Schema(
  {
    // vínculo opcional com o usuário base (quando existir)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    // Status online/offline
    online: { type: Boolean, default: false, index: true },

    // Identificação
    name: { type: String, required: true, trim: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // senha: guardada como hash, fora do select por padrão
    password: { type: String, required: true, select: false, minlength: 6 },

    // Documentos
    cpf: {
      type: String,
      required: true,
      unique: true,
      index: true,
      set: (v) => {
        const d = onlyDigits(v);
        return d || undefined;
      },
    },

    // CNH e afins (o app/ctrls usam 'cnh' simples; guardamos rico sem quebrar)
    cnh: {
      numero: {
        type: String,
        set: (v) => {
          const d = onlyDigits(v);
          return d || undefined;
        },
      },
      categoria: { type: String, trim: true }, // ex.: A, B, AB, ACC, etc.
      validade: { type: Date },
      situacao: {
        type: String,
        enum: ['ATIVA', 'SUSPENSA', 'CASSADA', 'VENCIDA', 'DESCONHECIDA'],
        default: 'DESCONHECIDA',
      },
    },

    // Contato/Endereço
    phone: {
      type: String,
      required: true,
      set: (v) => {
        const d = onlyDigits(v);
        return d || undefined;
      },
    },
    address: { type: String, trim: true },

    // Veículo
    vehicleType: {
      type: String,
      enum: ['carro', 'moto', 'van', 'caminhao', 'outro'],
      default: 'carro',
    },
    plateNumber: {
      type: String,
      trim: true,
      set: normalizePlate,
      index: true,
    },
    modelo: { type: String, trim: true }, // compat com controller que envia 'modelo'

    // Mídia
    fotoPerfil: { type: String, trim: true },
    fotos: [{ type: String, trim: true }],

    // Pagamentos/Recebimento
    dadosBancarios: {
      banco: { type: String, trim: true },
      agencia: { type: String, trim: true },
      conta: { type: String, trim: true },
      tipoConta: { type: String, trim: true }, // corrente/poupança/etc.
      titular: { type: String, trim: true },
      documentoTitular: {
        type: String,
        set: (v) => {
          const d = onlyDigits(v);
          return d || undefined;
        },
      },
    },
    pixKey: { type: String, trim: true },

    // Status de cadastro/fluxo
    statusCadastro: {
      type: String,
      enum: ['incompleto', 'em_validacao', 'aprovado', 'reprovado'],
      default: 'incompleto',
      index: true,
    },
    status: {
      type: String,
      enum: ['pendente', 'aprovado', 'reprovado'],
      default: 'pendente',
      index: true,
    },
    aprovado: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* ======================= VIRTUAIS DE COMPATIBILIDADE ======================= */
// Front/ctrls usam 'nome', 'telefone', 'veiculo', 'placa', 'endereco'
motoristaSchema
  .virtual('nome')
  .get(function () { return this.name; })
  .set(function (v) { this.name = v; });

motoristaSchema
  .virtual('telefone')
  .get(function () { return this.phone; })
  .set(function (v) { this.phone = v; });

motoristaSchema
  .virtual('veiculo')
  .get(function () { return this.vehicleType; })
  .set(function (v) { this.vehicleType = v; });

motoristaSchema
  .virtual('placa')
  .get(function () { return this.plateNumber; })
  .set(function (v) { this.plateNumber = v; });

motoristaSchema
  .virtual('endereco')
  .get(function () { return this.address; })
  .set(function (v) { this.address = v; });

/* ============================ ÍNDICES ADICIONAIS =========================== */
// Busca rápida por nome/placa
motoristaSchema.index({ name: 'text', plateNumber: 'text' });

/* ============================== HOOKS/HASHING ============================== */
motoristaSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const s = this.password || '';
  if (/^\$2[aby]\$/.test(s)) return next(); // já é hash bcrypt
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(s, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/* ============================== MÉTODOS ÚTEIS ============================== */
motoristaSchema.methods.matchPassword = async function (candidate) {
  const saved = this.password || '';
  return bcrypt.compare(String(candidate || ''), saved);
};

/* ========================== SERIALIZAÇÃO SEGURA ============================ */
motoristaSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Motorista', motoristaSchema);
