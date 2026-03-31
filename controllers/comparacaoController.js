// controllers/comparacaoController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Product = require('../models/product');
const Company = require('../models/company');
const config = require('../config/env');

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));
const asNumber = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// Haversine em KM
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
}

// Frete opcional por distância
function estimateFrete({ company, lat, lng }) {
  try {
    const base = asNumber(process.env.DELIVERY_BASE_FEE || config.delivery?.baseFee || 0);
    const perKm = asNumber(process.env.DELIVERY_RATE_PER_KM || config.delivery?.perKm || 0);
    const maxFee = asNumber(process.env.DELIVERY_MAX_FEE || config.delivery?.maxFee || Infinity);

    const coords = company?.location?.coordinates;
    if (!coords || coords.length !== 2) return 0;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;

    const km = distanceKm(coords[1], coords[0], lat, lng);
    const fee = Math.min(maxFee, +(base + perKm * km).toFixed(2));
    return fee >= 0 ? fee : 0;
  } catch {
    return 0;
  }
}

/**
 * POST /api/comparacao
 */
const compararOrcamento = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!items.length) {
    return res.status(400).json({ message: 'Nenhum item fornecido para comparação.' });
  }

  const merged = new Map();
  for (const it of items) {
    const pid = String(it?.productId || '').trim();
    const qty = asNumber(it?.quantity, NaN);

    if (!isObjectId(pid)) {
      return res.status(400).json({ message: `productId inválido: ${it?.productId}` });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: `Quantidade inválida para ${pid}` });
    }
    merged.set(pid, (merged.get(pid) || 0) + qty);
  }

  const productIds = [...merged.keys()];
  const products = await Product.find({ _id: { $in: productIds } })
    .populate('company', 'nome cidade uf porteEmpresa location')
    .lean();

  const foundIds = new Set(products.map((p) => String(p._id)));
  const missingProducts = productIds.filter((id) => !foundIds.has(id));

  if (!products.length) {
    return res.status(404).json({ message: 'Produtos não encontrados.', missingProducts });
  }

  const lat = asNumber(req.query?.lat, NaN);
  const lng = asNumber(req.query?.lng, NaN);
  const canCalcFrete = Number.isFinite(lat) && Number.isFinite(lng);

  const orcamentoMap = new Map();

  for (const prod of products) {
    const qty = merged.get(String(prod._id)) || 0;
    const price = asNumber(prod.price ?? prod.preco, 0);
    const nome = prod.nome || prod.name || 'Produto';

    const company = prod.company || null;
    if (!company || !company._id) continue;

    const cid = String(company._id);
    if (!orcamentoMap.has(cid)) {
      orcamentoMap.set(cid, {
        company: {
          _id: cid,
          nome: company.nome || 'Empresa',
          cidade: company.cidade || null,
          uf: company.uf || company.estado || null,
          porteEmpresa: company.porteEmpresa || 'pequena',
          location: company.location || null,
        },
        totalProdutos: 0,
        frete: 0,
        totalGeral: 0,
        items: [],
      });
    }

    const subtotal = +(price * qty).toFixed(2);
    const bucket = orcamentoMap.get(cid);

    bucket.items.push({
      product: {
        _id: String(prod._id),
        nome,
        price,
      },
      quantity: qty,
      subtotal,
    });

    bucket.totalProdutos = +(bucket.totalProdutos + subtotal).toFixed(2);
  }

  for (const [, bucket] of orcamentoMap.entries()) {
    const frete = canCalcFrete ? estimateFrete({ company: bucket.company, lat, lng }) : 0;
    bucket.frete = frete;
    bucket.totalGeral = +(bucket.totalProdutos + frete).toFixed(2);
  }

  const list = [...orcamentoMap.values()].sort((a, b) => {
    if (canCalcFrete) return a.totalGeral - b.totalGeral;
    return a.totalProdutos - b.totalProdutos;
  });

  return res.json({
    orcamentos: list,
    missingProducts,
    criteria: canCalcFrete ? 'totalGeral' : 'totalProdutos',
  });
});

/* ✅ EXPORT ÚNICO E CORRETO */
module.exports = {
  compararOrcamento,
};
