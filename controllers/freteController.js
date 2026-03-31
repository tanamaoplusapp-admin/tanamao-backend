// controllers/freteController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

// Normalizador simples de CEP (retorna só dígitos)
const normalizeCEP = (cep) => String(cep || '').replace(/\D/g, '').slice(0, 8);

// Heurística de distância baratinha usando os dois primeiros dígitos do CEP.
// Não é geocodificação real — só um fator para variar o preço (estável e offline).
function distanciaFator(cepDestino, cepOrigem) {
  const c1 = normalizeCEP(cepDestino).slice(0, 2);
  const c2 = normalizeCEP(cepOrigem || '').slice(0, 2);
  if (!c1) return 1.0;
  if (!c2) return 1.0;
  const d = Math.abs(parseInt(c1, 10) - parseInt(c2, 10)); // 0..99
  // 1.00 .. 1.40 (até +40% em “mais longe”)
  return Math.min(1.4, 1 + (d / 50));
}

// Regra de frete por empresa:
// - base: 7.90
// - por item: 2.50 * quantidade
// - peso: 0.80 por kg * quantidade (se informado); considera peso=1kg se omitido
// - mínimo por empresa: 9.90
// - fator de distância aplicado no final
function calcFreteEmpresa({ cep, origemCep, itens }) {
  const base = 7.9;
  const porItem = 2.5;
  const porKg = 0.8;
  const minimo = 9.9;

  let subtotal = base;
  for (const it of itens) {
    const q = Math.max(1, Number(it.quantidade) || 1);
    const pesoUnit = Number(it.peso);
    const peso = Number.isFinite(pesoUnit) && pesoUnit > 0 ? pesoUnit : 1; // 1kg default
    subtotal += porItem * q;
    subtotal += porKg * (peso * q);
  }

  const fator = distanciaFator(cep, origemCep);
  const total = Math.max(minimo, subtotal * fator);

  // arredonda para 2 casas, com duas casas fixas como número
  return Number(total.toFixed(2));
}

// POST /api/frete/cotar
// body: { cep, itens: [{ productId, quantidade, empresaId, peso, volume }], empresas?: [empresaId...] }
exports.cotar = asyncHandler(async (req, res) => {
  const { cep, itens, empresas } = req.body || {};

  const cepDestino = normalizeCEP(cep);
  if (!cepDestino || cepDestino.length < 8) {
    return res.status(400).json({ error: 'CEP inválido. Use 8 dígitos.' });
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Itens obrigatórios para cotação.' });
  }

  // Agrupa itens por empresa
  const mapPorEmpresa = new Map(); // empresaId -> itens[]
  for (const it of itens) {
    const empresaId = it.empresaId || it.companyId || 'desconhecida';
    if (!mapPorEmpresa.has(empresaId)) mapPorEmpresa.set(empresaId, []);
    mapPorEmpresa.get(empresaId).push(it);
  }

  // Se veio "empresas" no body, filtra apenas as listadas
  if (Array.isArray(empresas) && empresas.length > 0) {
    for (const id of Array.from(mapPorEmpresa.keys())) {
      if (!empresas.includes(id)) mapPorEmpresa.delete(id);
    }
  }

  if (mapPorEmpresa.size === 0) {
    return res.status(400).json({ error: 'Nenhuma empresa identificada nos itens.' });
  }

  // CEP de origem por empresa (se você tiver isso em Company, pode buscar aqui).
  // Por enquanto, deixamos vazio para aplicar fator neutro, ou configure algo como:
  // const origemPorEmpresa = { 'empresaId': '79000000' }
  const origemPorEmpresa = {};

  if (mapPorEmpresa.size === 1) {
    // Uma única empresa → responde { valor }
    const [empresaId] = mapPorEmpresa.keys();
    const itensEmpresa = mapPorEmpresa.get(empresaId);

    const valor = calcFreteEmpresa({
      cep: cepDestino,
      origemCep: origemPorEmpresa[empresaId],
      itens: itensEmpresa,
    });

    return res.json({ valor });
  }

  // Várias empresas → responde detalhado + total
  const empresasResp = [];
  let total = 0;

  for (const [empresaId, itensEmpresa] of mapPorEmpresa.entries()) {
    const valor = calcFreteEmpresa({
      cep: cepDestino,
      origemCep: origemPorEmpresa[empresaId],
      itens: itensEmpresa,
    });
    total += valor;
    empresasResp.push({ empresaId, valor });
  }

  return res.json({
    empresas: empresasResp,
    total: Number(total.toFixed(2)),
  });
});
