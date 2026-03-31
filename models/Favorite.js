const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', index: true },
  productId: { type: mongoose.Types.ObjectId, ref: 'Product', index: true },
}, { timestamps: true, indexes: [{ unique: true, fields: ['userId', 'productId'] }] });
module.exports = mongoose.model('Favorite', schema);
