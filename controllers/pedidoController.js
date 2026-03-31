const asyncHandler = require('express-async-handler');

let Order;
try { Order = require('../models/order'); } catch (_) {
  try { Order = require('../models/order'); } catch (e) {
    throw e;
  }
}

/* --------------------------- Helpers --------------------------- */
const normalizeStatus = (s) => {
  if (!s) return 'aguardando';
  const v = String(s).toLowerCase().trim();
  if (
    v === 'saiu_para_entrega' ||
    v === 'saiu-para-entrega' ||
    v === 'saiu para entrega' ||
    v === 'em rota' ||
    v === 'em-rota' ||
    v === 'em_rota' ||
    v === 'em-transito' ||
    v === 'em_transito' ||
    v === 'em-transporte' ||
    v === 'em_transporte'
  ) return 'em_rota';
  return v;
};
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const STATUS_INDEX = {
  aguardando: 0,
  preparando: 1,
  em_rota: 2,
  'saiu_para_entrega': 2,
  entregue: 3,
  cancelado: 4,
};

/* =================================================================
 * GET /api/pedidos/:id
 * =================================================================*/
exports.getPedidoById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pedido = await Order.findById(id)
    .populate('clienteId', 'name email')
    .populate('empresaId', 'nome razaoSocial')
    .populate('products.productId', 'nome preco imagens');

  if (!pedido) {
    res.status(404);
    throw new Error('Pedido não encontrado');
  }

  const status = normalizeStatus(pedido.deliveryStatus || pedido.status || 'aguardando');
  const statusIndex = STATUS_INDEX[status] ?? 0;

  res.status(200).json({
    pedidoId: pedido._id,
    status,
    statusIndex,
    localMotorista: pedido.localizacaoAtual || null,
    entregueEm: pedido.entregueEm || null,
    cliente: pedido.clienteId || null,
    empresa: pedido.empresaId || null,
    total: pedido.total,
    produtos: pedido.products || [],
    formaPagamento: pedido.formaPagamento || null,
    criadoEm: pedido.createdAt,
    pagamento: pedido.pagamento || null,
    recusaMotivo: pedido.recusaMotivo || null,
    canceladoEm: pedido.canceladoEm || null,
  });
});

/* =================================================================
 * PUT /api/pedidos/:id/iniciar-entrega
 * =================================================================*/
exports.iniciarEntrega = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lat = toNumber(req.body?.latitude);
  const lng = toNumber(req.body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'latitude/longitude inválidos' });
  }

  const pedido = await Order.findById(id);
  if (!pedido) {
    res.status(404);
    throw new Error('Pedido não encontrado');
  }

  pedido.deliveryStatus = 'em_rota';
  pedido.localizacaoAtual = { latitude: lat, longitude: lng };
  await pedido.save();

  res.status(200).json({
    mensagem: 'Entrega iniciada com sucesso',
    pedidoId: pedido._id,
    status: pedido.deliveryStatus,
    localizacao: pedido.localizacaoAtual,
  });
});

/* =================================================================
 * PUT /api/pedidos/:id/atualizar-localizacao
 * =================================================================*/
exports.atualizarLocalizacao = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const lat = toNumber(req.body?.latitude);
  const lng = toNumber(req.body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'latitude/longitude inválidos' });
  }

  const pedido = await Order.findById(id);
  if (!pedido) {
    res.status(404);
    throw new Error('Pedido não encontrado');
  }

  pedido.localizacaoAtual = { latitude: lat, longitude: lng };
  await pedido.save();

  res.status(200).json({ mensagem: 'Localização atualizada', localizacao: pedido.localizacaoAtual });
});

/* =================================================================
 * PUT /api/pedidos/:id/finalizar-entrega
 * =================================================================*/
exports.finalizarEntrega = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pedido = await Order.findById(id);
  if (!pedido) {
    res.status(404);
    throw new Error('Pedido não encontrado');
  }

  pedido.deliveryStatus = 'entregue';
  pedido.entregueEm = new Date();
  await pedido.save();

  res.status(200).json({
    mensagem: 'Entrega finalizada com sucesso',
    entregueEm: pedido.entregueEm,
    status: pedido.deliveryStatus,
  });
});

/* =================================================================
 * PUT /api/pedidos/:id/recusar  { motivo }
 * Marca como cancelado e registra o motivo da recusa
 * =================================================================*/
exports.recusarPedido = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const motivo = (req.body?.motivo || '').toString().trim();

  if (!motivo) {
    return res.status(400).json({ message: 'Informe o motivo da recusa.' });
  }

  const pedido = await Order.findById(id);
  if (!pedido) {
    res.status(404);
    throw new Error('Pedido não encontrado');
  }

  pedido.deliveryStatus = 'cancelado';
  pedido.canceladoEm = new Date();
  pedido.recusaMotivo = motivo;
  await pedido.save();

  res.status(200).json({
    mensagem: 'Pedido recusado',
    status: pedido.deliveryStatus,
    canceladoEm: pedido.canceladoEm,
    recusaMotivo: pedido.recusaMotivo,
  });
});

/* =================================================================
 * NOVOS ENDPOINTS PARA AS TELAS
 * =================================================================*/

/** PUT /api/pedidos/:id/aceitar  { usuarioId? } */
exports.aceitarPedido = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.body?.usuarioId || (req.user && (req.user._id || req.user.id)) || null;

  const pedido = await Order.findById(id);
  if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' });

  // Transição segura: aguardando -> preparando (mantém outros estágios se já estiver além)
  if (normalizeStatus(pedido.deliveryStatus) === 'aguardando') {
    pedido.deliveryStatus = 'preparando';
  }
  pedido.aceitoPor = usuarioId || pedido.aceitoPor || null;
  await pedido.save();

  return res.status(200).json({
    mensagem: 'Pedido aceito',
    pedidoId: pedido._id,
    status: pedido.deliveryStatus,
  });
});

/** PUT /api/pedidos/:id/solicitar-motorista  { motoristaId? | criterios? } */
exports.solicitarMotorista = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { motoristaId, criterios } = req.body || {};

  const pedido = await Order.findById(id);
  if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' });

  pedido.solicitacaoMotorista = {
    ativa: true,
    motoristaId: motoristaId || null,
    criterios: criterios || null,
    criadoEm: new Date(),
  };
  await pedido.save();

  return res.status(200).json({
    mensagem: 'Motorista solicitado',
    pedidoId: pedido._id,
    acao: 'motorista_solicitado',
    solicitacao: pedido.solicitacaoMotorista,
  });
});

/** PUT /api/pedidos/:id/cancelar-solicitacao-motorista */
exports.cancelarSolicitacaoMotorista = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pedido = await Order.findById(id);
  if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' });

  pedido.solicitacaoMotorista = { ativa: false, canceladaEm: new Date() };
  await pedido.save();

  return res.status(200).json({
    mensagem: 'Solicitação cancelada',
    pedidoId: pedido._id,
    acao: 'solicitacao_cancelada',
  });
});

/** PUT /api/pedidos/:id/finalizar  { observacoes?, valorFinal? } */
exports.finalizarPedido = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { observacoes, valorFinal } = req.body || {};

  const pedido = await Order.findById(id);
  if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' });

  if (typeof valorFinal === 'number' && Number.isFinite(valorFinal)) {
    pedido.total = valorFinal;
  }
  pedido.deliveryStatus = 'entregue';
  pedido.entregueEm = new Date();
  if (observacoes) pedido.finalizadoObs = String(observacoes);

  await pedido.save();

  return res.status(200).json({
    mensagem: 'Pedido finalizado',
    pedidoId: pedido._id,
    status: pedido.deliveryStatus,
    entregueEm: pedido.entregueEm,
    total: pedido.total,
  });
});
