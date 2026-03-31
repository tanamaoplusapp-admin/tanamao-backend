const mongoose = require('mongoose');
const { Schema } = mongoose;

const galeriaSchema = new Schema(
  {
    profissional: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    descricao: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    ordem: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Galeria ||
  mongoose.model('Galeria', galeriaSchema);