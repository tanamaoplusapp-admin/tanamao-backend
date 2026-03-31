// controllers/productController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Product = require('../models/product');

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

const normalize = (s = '') =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const rx = (s) =>
  new RegExp(
    normalize(String(s || '').trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i'
  );

/* =============================== SEARCH =============================== */
// GET /api/products/search?q=...&company=...&categoria=...&page=1&limit=20&sort=relevance|price_asc|price_desc|recent
exports.getProducts = asyncHandler(async (req, res) => {
  const {
    q = '',
    company,
    categoria,
    page = 1,
    limit = 20,
    sort = 'relevance',
  } = req.query || {};

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const filters = {};
  if (company && isId(company)) filters.company = company;
  if (categoria && String(categoria).trim()) filters.category = rx(categoria);

  let sortObj = { createdAt: -1 };
  if (sort === 'price_asc') sortObj = { price: 1, createdAt: -1 };
  else if (sort === 'price_desc') sortObj = { price: -1, createdAt: -1 };
  else if (sort === 'recent') sortObj = { createdAt: -1 };

  const term = String(q || '').trim();

  // 1) $text para máxima relevância (inclui searchBlob, name, brand, category, description)
  if (term) {
    const q1 = { ...filters, $text: { $search: term } };
    const projection = { score: { $meta: 'textScore' } };
    const sortText =
      sort === 'relevance' ? { score: { $meta: 'textScore' } } : sortObj;

    const [items, total] = await Promise.all([
      Product.find(q1, projection)
        .populate('company', 'nome')
        .sort(sortText)
        .skip(skip)
        .limit(lim)
        .lean(),
      Product.countDocuments(q1),
    ]);

    if (items.length > 0) {
      return res.json({
        items,
        total,
        page: pg,
        pages: Math.ceil(total / lim),
      });
    }
  }

  // 2) Fallback regex em nome/marca/categoria/descrição e características
  const or = term
    ? [
        { name: rx(term) },
        { brand: rx(term) },
        { category: rx(term) },
        { description: rx(term) },
        { 'caracteristicas.chave': rx(term) },
        { 'caracteristicas.valor': rx(term) },
      ]
    : [];

  const q2 = or.length ? { $and: [filters, { $or: or }] } : filters;

  const [items2, total2] = await Promise.all([
    Product.find(q2)
      .populate('company', 'nome')
      .sort(sortObj)
      .skip(skip)
      .limit(lim)
      .lean(),
    Product.countDocuments(q2),
  ]);

  return res.json({
    items: items2,
    total: total2,
    page: pg,
    pages: Math.ceil(total2 / lim),
  });
});

/* ============================== SUGGEST =============================== */
// GET /api/products/suggest?q=...&limit=8
exports.suggestProducts = asyncHandler(async (req, res) => {
  const { q = '', limit = 8 } = req.query || {};
  const term = String(q || '').trim();
  if (!term) return res.json([]);

  // consulta leve em campos principais + características
  const items = await Product.find(
    {
      $or: [
        { name: rx(term) },
        { brand: rx(term) },
        { category: rx(term) },
        { description: rx(term) },
        { 'caracteristicas.chave': rx(term) },
        { 'caracteristicas.valor': rx(term) },
      ],
    },
    { name: 1, brand: 1, category: 1 }
  )
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(20, parseInt(limit, 10) || 8)))
    .lean();

  res.json(
    items.map((p) => ({
      id: p._id,
      label: [p.brand, p.name].filter(Boolean).join(' ').trim() || p.name,
      categoria: p.category || '',
    }))
  );
});

/* ================================ READ =============================== */
exports.getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ error: 'ID de produto inválido' });

  const product = await Product.findById(id)
    .populate('company', 'nome')
    .lean();

  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

  res.json(product);
});
