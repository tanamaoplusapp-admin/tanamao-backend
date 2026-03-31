// controllers/profissionalOfertaController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ProfissionalOferta = require('../models/ProfissionalOferta');

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));

function getUserId(u = {}) {
  return u.userId || u.id || u._id;
}

function assertOwnerOrThrow(req, profissionalIdParam) {
  const userId = String(getUserId(req.user || '') || '');
  const profId = String(profissionalIdParam || '');
  if (!userId || !profId || userId !== profId) {
    const err = new Error('Acesso negado para este recurso.');
    err.status = 403;
    throw err;
  }
}

exports.create = asyncHandler(async (req, res) => {
  const { id: profissionalId } = req.params;
  if (!isId(profissionalId)) return res.status(400).json({ error: 'ID de profissional inválido.' });
  assertOwnerOrThrow(req, profissionalId);

  const { titulo, descricao, preco, status = 'ativa' } = req.body || {};
  const nPreco = Number(preco);
  if (!titulo || !descricao || !Number.isFinite(nPreco) || nPreco < 0) {
    return res.status(400).json({ error: 'Dados inválidos. Verifique título, descrição e preço.' });
  }

  const doc = await ProfissionalOferta.create({
    profissional: profissionalId,
    titulo: String(titulo).trim(),
    descricao: String(descricao).trim(),
    preco: nPreco,
    status: status === 'inativa' ? 'inativa' : 'ativa',
  });

  res.status(201).json(doc.toJSON());
});

exports.list = asyncHandler(async (req, res) => {
  const { id: profissionalId } = req.params;
  if (!isId(profissionalId)) return res.status(400).json({ error: 'ID de profissional inválido.' });

  const { status, page = 1, limit = 20 } = req.query || {};
  const filter = { profissional: profissionalId };
  if (status && ['ativa', 'inativa'].includes(String(status))) filter.status = status;

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const [items, total] = await Promise.all([
    ProfissionalOferta.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    ProfissionalOferta.countDocuments(filter),
  ]);

  res.json({ items, total, page: pg, pages: Math.ceil(total / lim) });
});

exports.update = asyncHandler(async (req, res) => {
  const { id: profissionalId, ofertaId } = req.params;
  if (!isId(profissionalId) || !isId(ofertaId)) {
    return res.status(400).json({ error: 'IDs inválidos.' });
  }
  assertOwnerOrThrow(req, profissionalId);

  const doc = await ProfissionalOferta.findById(ofertaId);
  if (!doc) return res.status(404).json({ error: 'Oferta não encontrada.' });
  if (String(doc.profissional) !== String(profissionalId)) {
    return res.status(403).json({ error: 'Você não pode editar esta oferta.' });
    }

  const { titulo, descricao, preco, status } = req.body || {};
  if (titulo !== undefined) doc.titulo = String(titulo).trim();
  if (descricao !== undefined) doc.descricao = String(descricao).trim();
  if (preco !== undefined) {
    const n = Number(preco);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Preço inválido.' });
    doc.preco = n;
  }
  if (status !== undefined) {
    if (!['ativa', 'inativa'].includes(String(status))) {
      return res.status(400).json({ error: 'Status inválido.' });
    }
    doc.status = status;
  }

  await doc.save();
  res.json(doc.toJSON());
});

exports.remove = asyncHandler(async (req, res) => {
  const { id: profissionalId, ofertaId } = req.params;
  if (!isId(profissionalId) || !isId(ofertaId)) {
    return res.status(400).json({ error: 'IDs inválidos.' });
  }
  assertOwnerOrThrow(req, profissionalId);

  const doc = await ProfissionalOferta.findById(ofertaId);
  if (!doc) return res.status(404).json({ error: 'Oferta não encontrada.' });
  if (String(doc.profissional) !== String(profissionalId)) {
    return res.status(403).json({ error: 'Você não pode excluir esta oferta.' });
  }

  await doc.deleteOne();
  res.json({ message: 'Oferta removida com sucesso' });
});
