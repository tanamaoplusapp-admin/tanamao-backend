const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Order = require('../models/order');

/* ===================== Helpers ===================== */
const VALID_STATUS = new Set([
  'aguardando',
  'preparando',
  'em_rota',
  'entregue',
  'cancelado',
  'saiu_para_entrega',
]);

function normalizeStatus(s) {
  const v = String(s || '').trim().toLowerCase();
  if (v === 'saiu_para_entrega') return 'em_rota';
  return VALID_STATUS.has(v) ? v : null;
}

function toNumber(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function parseDate(d) {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t) : null;
}

/* ===================== Controllers ===================== */

const getPedidosDoMotorista = asyncHandler(async (req, res) => {
  const motoristaId = req.user?._id || req.user?.id || req.userId;

  if (!motoristaId || !mongoose.Types.ObjectId.isValid(String(motoristaId))) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  const page = Math.max(1, toNumber(req.query.page, 1));
  const limit = Math.min(100, Math.max(1, toNumber(req.query.limit, 20)));
  const skip = (page - 1) * limit;

  let statuses = null;
  if (req.query.status) {
    statuses = String(req.query.status)
      .split(',')
      .map(normalizeStatus)
      .filter(Boolean);
    if (!statuses.length) statuses = null;
  }

  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const dateFilter = {};
  if (from) dateFilter.$gte = from;
  if (to) dateFilter.$lte = to;

  const match = { motoristaId };
  if (statuses) match.deliveryStatus = { $in: statuses };
  if (Object.keys(dateFilter).length) match.createdAt = dateFilter;

  const [total, docs] = await Promise.all([
    Order.countDocuments(match),
    Order.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('clienteId', 'name nome')
      .populate('empresaId', 'nome')
      .lean(),
  ]);

  const items = docs.map((p) => ({
    _id: p._id,
    status: normalizeStatus(p.deliveryStatus),
    enderecoEntrega:
      p.enderecoEntrega ||
      p.destino?.endereco ||
      p.addressEntrega ||
      p.entrega?.endereco ||
      null,
    nomeCliente: p.clienteId?.name || p.clienteId?.nome || 'Cliente',
    nomeEmpresa: p.empresaId?.nome || 'Empresa',
    createdAt: p.createdAt,
    hora: new Date(p.createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    localizacaoAtual: p.localizacaoAtual || null,
    total: typeof p.total === 'number' ? p.total : null,
  }));

  return res.json({
    page,
    limit,
    total,
    hasNextPage: skip + items.length < total,
    items,
  });
});

const updateLocalizacao = asyncHandler(async (req, res) => {
  const motoristaId = req.user?._id || req.user?.id || req.userId;
  const { orderId } = req.params;
  const { latitude, longitude } = req.body || {};

  if (!motoristaId || !mongoose.Types.ObjectId.isValid(String(motoristaId))) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
    return res.status(400).json({ message: 'orderId inválido' });
  }

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

  if (String(order.motoristaId) !== String(motoristaId)) {
    return res.status(403).json({ message: 'Pedido não pertence a este motorista' });
  }

  order.localizacaoAtual = {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };

  await order.save();

  return res.json({
    message: 'Localização atualizada',
    localizacaoAtual: order.localizacaoAtual,
  });
});

const atualizarStatusPedido = asyncHandler(async (req, res) => {
  const motoristaId = req.user?._id || req.user?.id || req.userId;
  const { orderId } = req.params;
  const status = normalizeStatus(req.body?.status);

  if (!motoristaId || !mongoose.Types.ObjectId.isValid(String(motoristaId))) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
    return res.status(400).json({ message: 'orderId inválido' });
  }

  if (!status) {
    return res.status(400).json({ message: 'Status inválido' });
  }

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

  if (String(order.motoristaId) !== String(motoristaId)) {
    return res.status(403).json({ message: 'Pedido não pertence a este motorista' });
  }

  order.deliveryStatus = status;
  if (status === 'entregue') {
    order.entregueEm = new Date();
  }

  await order.save();

  return res.json({
    message: 'Status atualizado',
    status: order.deliveryStatus,
  });
});

const getHistoricoEntregas = asyncHandler(async (req, res) => {
  const motoristaId = req.user?._id || req.user?.id || req.userId;

  if (!motoristaId || !mongoose.Types.ObjectId.isValid(String(motoristaId))) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  const docs = await Order.find({
    motoristaId,
    deliveryStatus: 'entregue',
  })
    .sort({ createdAt: -1 })
    .populate('empresaId', 'nome')
    .lean();

  return res.json(
    docs.map((p) => ({
      _id: p._id,
      nomeEmpresa: p.empresaId?.nome || 'Empresa',
      total: p.total || 0,
      entregueEm: p.entregueEm || p.updatedAt || p.createdAt,
    }))
  );
});

/* ===================== EXPORT ===================== */
module.exports = {
  getPedidosDoMotorista,
  updateLocalizacao,
  atualizarStatusPedido,
  getHistoricoEntregas,
};
