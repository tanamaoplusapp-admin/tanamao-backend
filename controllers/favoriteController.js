const Favorite = require('../models/Favorite');

exports.list = async (req, res) => {
  const userId = req.userId || req.user?.id;
  const items = await Favorite.find({ userId }).populate('productId');
  res.json({ items });
};

exports.add = async (req, res) => {
  const userId = req.userId || req.user?.id;
  const { productId } = req.body;
  await Favorite.updateOne({ userId, productId }, { $set: { userId, productId }}, { upsert: true });
  res.status(201).json({ ok: true });
};

exports.remove = async (req, res) => {
  const userId = req.userId || req.user?.id;
  await Favorite.deleteOne({ userId, productId: req.params.productId });
  res.json({ ok: true });
};
