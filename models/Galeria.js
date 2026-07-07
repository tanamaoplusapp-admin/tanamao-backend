const mongoose = require('mongoose');

const { Schema } = mongoose;

const fotoSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    descricao: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    ordem: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const galeriaSchema = new Schema(
  {
    profissional: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    titulo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },

    capa: {
      type: String,
      trim: true,
      default: null,
    },

    fotos: {
      type: [fotoSchema],
      default: [],
    },

    ordem: {
      type: Number,
      default: 0,
    },

    ativo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

galeriaSchema.index({
  profissional: 1,
  ordem: 1,
});

module.exports =
  mongoose.models.Galeria ||
  mongoose.model('Galeria', galeriaSchema);