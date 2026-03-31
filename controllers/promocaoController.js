// controllers/promocaoController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Promocao = require('../models/Promocao');
const Product = require('../models/product');

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

/** Descobre a empresa do usuário autenticado a partir de Product.company */
async function getCompanyIdFromUser(user = {}) {
  // Em muitos setups o token da empresa já traz o id da Company em user.id
  return user.companyId || user._id || user.userId || user.id;
}

/** Cria promoção (empresa logada, produto precisa pertencer à empresa) */
exports.create = asyncHandler(async (req, res) => {
  const { productId, originalPrice, promoPrice, validUntil } = req.body || {};

  if (!isId(productId)) {
    return res.status(400).json({ error: 'productId inválido.' });
  }

  const companyId = await getCompanyIdFromUser(req.user || {});
  if (!isId(companyId)) {
    return res.status(403).json({ error: 'Empresa não identificada no token.' });
  }

  const product = await Product.findById(productId).lean();
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

  if (String(product.company) !== String(companyId)) {
    return res.status(403).json({ error: 'Você não pode criar promoção para este produto.' });
  }

  const original = Number(originalPrice);
  const promo = Number(promoPrice);
  const vUntil = new Date(validUntil);

  if (!Number.isFinite(original) || original < 0) {
    return res.status(400).json({ error: 'Preço original inválido.' });
  }
  if (!Number.isFinite(promo) || promo < 0) {
    return res.status(400).json({ error: 'Preço promocional inválido.' });
  }
  if (!(vUntil instanceof Date) || isNaN(vUntil.getTime())) {
    return res.status(400).json({ error: 'Data de validade inválida.' });
  }

  const promoDoc = await Promocao.create({
    product: productId,
    company: companyId,
    originalPrice: original,
    promoPrice: promo,
    validUntil: vUntil,
    isActive: true,
  });

  const populated = await Promocao.findById(promoDoc._id)
    .populate('product', 'name price images')
    .lean();

  res.status(201).json({ message: 'Promoção criada com sucesso', promocao: populated });
});

/** Lista promoções (com filtros) */
exports.list = asyncHandler(async (req, res) => {
  const {
    company,        // opcional: força empresa específica
    product,        // opcional: força produto específico
    activeOnly = 'true',
    page = 1,
    limit = 20,
  } = req.query || {};

  const filter = {};
  if (company && isId(company)) filter.company = company;
  if (product && isId(product)) filter.product = product;

  // apenas ativas e não vencidas (padrão)
  if (String(activeOnly) !== 'false') {
    filter.isActive = true;
    filter.validUntil = { $gte: new Date() };
  }

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const [items, total] = await Promise.all([
    Promocao.find(filter)
      .populate('product', 'name price images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    Promocao.countDocuments(filter),
  ]);

  res.json({
    items,
    total,
    page: pg,
    pages: Math.ceil(total / lim),
  });
});

/** Lista apenas ativas (atalho) */
exports.active = asyncHandler(async (_req, res) => {
  const filter = { isActive: true, validUntil: { $gte: new Date() } };
  const items = await Promocao.find(filter)
    .populate('product', 'name price images')
    .sort({ createdAt: -1 })
    .lean();

  res.json(items);
});

/** Atualiza promoção (empresa dona) */
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'ID inválido.' });

  const promo = await Promocao.findById(id);
  if (!promo) return res.status(404).json({ error: 'Promoção não encontrada.' });

  const companyId = await getCompanyIdFromUser(req.user || {});
  if (String(promo.company) !== String(companyId)) {
    return res.status(403).json({ error: 'Você não pode editar esta promoção.' });
  }

  const { originalPrice, promoPrice, validUntil, isActive } = req.body || {};

  if (originalPrice !== undefined) {
    const n = Number(originalPrice);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Preço original inválido.' });
    promo.originalPrice = n;
  }
  if (promoPrice !== undefined) {
    const n = Number(promoPrice);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Preço promocional inválido.' });
    promo.promoPrice = n;
  }
  if (validUntil !== undefined) {
    const d = new Date(validUntil);
    if (!(d instanceof Date) || isNaN(d.getTime())) return res.status(400).json({ error: 'Data inválida.' });
    promo.validUntil = d;
  }
  if (isActive !== undefined) {
    promo.isActive = !!isActive;
  }

  await promo.save();

  const populated = await Promocao.findById(id)
    .populate('product', 'name price images')
    .lean();

  res.json({ message: 'Promoção atualizada', promocao: populated });
});

/** Remove promoção (empresa dona) */
exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'ID inválido.' });

  const promo = await Promocao.findById(id);
  if (!promo) return res.status(404).json({ error: 'Promoção não encontrada.' });

  const companyId = await getCompanyIdFromUser(req.user || {});
  if (String(promo.company) !== String(companyId)) {
    return res.status(403).json({ error: 'Você não pode excluir esta promoção.' });
  }

  await promo.deleteOne();
  res.json({ message: 'Promoção removida com sucesso' });
});
