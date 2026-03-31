// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { celebrate, Joi, Segments } = require('celebrate');

const Product = require('../models/product');
const productController = require('../controllers/productController');

/* =========================
 * Auth middleware (SEGURO)
 * ========================= */
let verifyToken, requireRoles;

try {
  const auth = require('../middleware/verifyToken');
  verifyToken = auth.verifyToken;
  requireRoles = auth.requireRoles;
} catch (err) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken;
    requireRoles = auth.requireRoles;
  } catch {
    console.warn('[productRoutes] ⚠️ Auth middleware ausente — rotas protegidas liberadas');
    verifyToken = (_req, _res, next) => next();
    requireRoles = () => (_req, _res, next) => next();
  }
}

const isObjId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

/* =========================
 * Validações com celebrate
 * ========================= */
const createBody = celebrate({
  [Segments.BODY]: Joi.object({
    nome: Joi.string().min(2).required(),
    descricao: Joi.string().allow('').optional(),
    preco: Joi.number().min(0).required(),
    categoria: Joi.string().allow('').optional(),
    imagem: Joi.string().uri().optional(),
    imagens: Joi.array().items(Joi.string().uri()).optional(),
    brand: Joi.string().allow('').optional(),
    unit: Joi.string().allow('').optional(),
    weight: Joi.string().allow('').optional(),
    thickness: Joi.string().allow('').optional(),
  }).unknown(false),
});

const idParam = celebrate({
  [Segments.PARAMS]: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  }),
});

const updateBody = celebrate({
  [Segments.BODY]: Joi.object({
    nome: Joi.string().min(2).required(),
    descricao: Joi.string().allow('').optional(),
    preco: Joi.number().min(0).required(),
    categoria: Joi.string().allow('').optional(),
    imagem: Joi.string().uri().optional(),
    imagens: Joi.array().items(Joi.string().uri()).optional(),
    brand: Joi.string().allow('').optional(),
    unit: Joi.string().allow('').optional(),
    weight: Joi.string().allow('').optional(),
    thickness: Joi.string().allow('').optional(),
  }).unknown(false),
});

/* =========================
 * Helpers
 * ========================= */
function collectImages({ imagem, imagens }) {
  if (Array.isArray(imagens) && imagens.length) return imagens;
  if (typeof imagem === 'string' && imagem.trim()) return [imagem.trim()];
  return [];
}

/* =========================
 * Rotas públicas
 * ========================= */

router.get('/search', productController.getProducts);
router.get('/suggest', productController.suggestProducts);

router.get('/', async (req, res) => {
  try {
    const { q, categoria, companyId, min, max } = req.query;
    const filter = {};

    if (q) {
      filter.$or = [
        { name: new RegExp(String(q), 'i') },
        { description: new RegExp(String(q), 'i') },
      ];
    }

    if (categoria) filter.category = categoria;
    if (companyId && isObjId(companyId)) filter.company = companyId;

    if (min || max) {
      filter.price = {};
      if (min) filter.price.$gte = Number(min);
      if (max) filter.price.$lte = Number(max);
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('[products:list]', err);
    res.status(500).json({ error: 'Erro ao listar produtos' });
  }
});

router.get('/:id', idParam, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(product);
  } catch (err) {
    console.error('[products:getById]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* =========================
 * Rotas protegidas (empresa)
 * ========================= */

router.get('/meus', verifyToken, requireRoles('empresa'), async (req, res) => {
  try {
    const produtos = await Product.find({ company: req.user.id });
    res.json(produtos);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/', verifyToken, requireRoles('empresa'), createBody, async (req, res) => {
  try {
    const product = await Product.create({
      name: req.body.nome.trim(),
      description: (req.body.descricao || '').trim(),
      price: Number(req.body.preco),
      category: (req.body.categoria || '').trim(),
      images: collectImages(req.body),
      brand: req.body.brand || undefined,
      unit: req.body.unit || undefined,
      weight: req.body.weight || undefined,
      thickness: req.body.thickness || undefined,
      company: req.user.id,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error('[products:create]', err);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

router.put('/:id', verifyToken, requireRoles('empresa'), idParam, updateBody, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    if (String(product.company) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    Object.assign(product, {
      name: req.body.nome.trim(),
      description: (req.body.descricao || '').trim(),
      price: Number(req.body.preco),
      category: (req.body.categoria || '').trim(),
      images: collectImages(req.body),
      brand: req.body.brand || undefined,
      unit: req.body.unit || undefined,
      weight: req.body.weight || undefined,
      thickness: req.body.thickness || undefined,
    });

    await product.save();
    res.json(product);
  } catch (err) {
    console.error('[products:update]', err);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

router.delete('/:id', verifyToken, requireRoles('empresa'), idParam, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    if (String(product.company) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await product.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('[products:delete]', err);
    res.status(500).json({ error: 'Erro ao deletar produto' });
  }
});

module.exports = router;
