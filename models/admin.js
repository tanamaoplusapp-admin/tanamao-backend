// backend/models/admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const onlyDigits = (v) => (v ? String(v).replace(/\D+/g, '') : v);

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    cpf: {
      type: String,
      required: true,
      unique: true,
      set: onlyDigits,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // não retorna por padrão
    },

    phone: { type: String, trim: true },

    role: { type: String, default: 'admin', immutable: true },

    isVerified: { type: Boolean, default: true },

    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// hash em save (não faça hash manual no seed)
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(String(this.password), 10);
    next();
  } catch (err) {
    next(err);
  }
});

adminSchema.methods.matchPassword = function (candidate) {
  return bcrypt.compare(String(candidate || ''), this.password);
};

adminSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  return obj;
};

// 🔑 evita “OverwriteModelError” em dev/hot-reload
module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
