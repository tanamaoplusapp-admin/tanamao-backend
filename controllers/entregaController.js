// backend/controllers/entregaController.js
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Order = require('../models/order');

// helpers
const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));
const asNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const getUserId = (req) => (req.user?._id || req.userId || req.user?.id || '').toString();
const getUserRole = (req) => (req.user?.role || req.user?.tipo || '').toLowerCase();

/**
 * Verifica se o usuário autenticado tem permissão no pedido:
 * - motorista: precisa ser o motorista designado do pedido
 * - empresa: precisa ser a empresa dona do pedido
 * - admin (se existir no seu sistema): libera
 */
async function assertPermission(req, pedido) {
  const role = getUserRole(req);
  const uid = getUserId(req);

  if (!uid) {
    const err = new Error('Usuário não autenticado');
    err.statusCode = 401;
    throw err;
  }

  if (role === 'admin' || role === 'administrator') return; // opcional

  if (role === 'motorista') {
    if (!pedido.motoristaId || String(pedido.motoristaId) !== uid) {
      const err = new Error('Sem permissão: pedido não pertence a este motorista');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (role === 'empresa') {
    if (!pedido.empresaId || String(pedido.empresaId) !== uid) {
      const err = new Error('Sem permissão: pedido não pertence a esta empresa');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  // cliente não pode movimentar/atualizar rota/entrega
  const err = new Error('Perfil sem permissão para esta ação');
  err.statusCode = 403;
  throw err;
}

/**
 * POST /api/entregas/localizacao
 * body: { orderId, latitude, longitude }
 * Private (motorista/empresa)
 *
 * Atualiza a última localização do pedido. Se o status estiver "aguardando" ou "preparando",
 * podemos promover para "em_rota" (opcional, ligado por padrão).
 */
exports.registrarLocalizacao = asyncHandler(async (req, res) => {
  const orderId = String(req.body?.orderId || '').trim();
  const lat = asNumber(req.body?.latitude);
  const lng = asNumber(req.body?.longitude);

  if (!isObjectId(orderId)) {
    return res.status(400).json({ message: 'orderId inválido' });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'Latitude/longitude inválidas' });
  }

  const pedido = await Order.findById(orderId);
  if (!pedido) {
    return res.status(404).json({ message: 'Pedido não encontrado' });
  }

  await assertPermission(req, pedido);

  // salva última localização
  pedido.localizacaoAtual = { latitude: lat, longitude: lng };

  // opcional: promove status para "em_rota" quando começa a reportar posição
  if (['aguardando', 'preparando', 'saiu_para_entrega'].includes(pedido.deliveryStatus)) {
    pedido.deliveryStatus = 'em_rota';
  }

  await pedido.save();

  return res.status(200).json({
    message: 'Localização atualizada com sucesso',
    deliveryStatus: pedido.deliveryStatus,
    localizacaoAtual: pedido.localizacaoAtual,
  });
});

/**
 * POST /api/entregas/confirmar
 * body: { orderId }
 * Private (motorista/empresa)
 *
 * Marca o pedido como entregue. Registra "entregueEm" e normaliza o status.
 */
exports.confirmarEntrega = asyncHandler(async (req, res) => {
  const orderId = String(req.body?.orderId || '').trim();

  if (!isObjectId(orderId)) {
    return res.status(400).json({ message: 'orderId inválido' });
  }

  const pedido = await Order.findById(orderId);
  if (!pedido) {
    return res.status(404).json({ message: 'Pedido não encontrado' });
  }

  await assertPermission(req, pedido);

  // marca entregue
  pedido.deliveryStatus = 'entregue';
  pedido.entregueEm = new Date();

  await pedido.save();

  return res.status(200).json({
    message: 'Pedido marcado como entregue',
    pedidoId: pedido._id,
    entregueEm: pedido.entregueEm,
    deliveryStatus: pedido.deliveryStatus,
  });
});
