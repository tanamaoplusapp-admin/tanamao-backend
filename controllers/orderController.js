// controllers/orderController.js
'use strict';

const Order = require('../models/order');
const Company = require('../models/company');

/* =========================
 * Helpers
 * ========================= */
const getUserId = (req) =>
  (req.user?._id || req.userId || req.user?.id || null);

/**
 * Normaliza status vindos de várias fontes
 */
const STATUS_MAP = {
  'aguardando': 'aguardando',
  'pendente': 'aguardando',
  'pending': 'aguardando',

  'preparando': 'preparando',
  'preparing': 'preparando',

  'em rota': 'em_rota',
  'em_rota': 'em_rota',
  'em-transito': 'em_rota',
  'em_transito': 'em_rota',
  'saiu para entrega': 'em_rota',

  'entregue': 'entregue',
  'delivered': 'entregue',

  'cancelado': 'cancelado',
  'cancelled': 'cancelado',
};

function normalizeStatus(status) {
  if (!status) return 'aguardando';
  const key = String(status).toLowerCase().trim();
  return STATUS_MAP[key] || 'aguardando';
}

function asNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/* =====================================================
 * CONTROLLERS
 * ===================================================== */

/**
 * POST /api/orders
 * Criação de pedido após pagamento (PIX / cartão / webhook)
 */
exports.createOrderAfterPayment = async (req, res) => {
  try {
    const {
      products,
      total,
      companyId,
      empresaId,
      formaPagamento,
      status,
      pagamento = {},
      comissao = 0,
      valorLiquido = 0,
    } = req.body || {};

    const empresa = empresaId || companyId;
    const userId = getUserId(req);

    if (!empresa) {
      return res.status(400).json({ error: 'companyId é obrigatório' });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Produtos são obrigatórios' });
    }

    if (!formaPagamento) {
      return res.status(400).json({ error: 'formaPagamento é obrigatória' });
    }

    const company = await Company.findById(empresa);
    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    // 🔁 Idempotência por pagamento.idPagamento
    if (pagamento?.idPagamento) {
      const existing = await Order.findOne({
        'pagamento.idPagamento': pagamento.idPagamento,
      });

      if (existing) {
        return res.json({
          message: 'Pedido já existente (idempotente)',
          pedidoId: existing._id,
        });
      }
    }

    const order = await Order.create({
      clienteId: userId || undefined,
      empresaId: empresa,
      products,
      total: asNumber(total),
      formaPagamento,
      comissao: asNumber(comissao),
      valorLiquido: asNumber(valorLiquido),
      deliveryStatus: normalizeStatus(status),
      pagamento,
      dataPedido: new Date(),
    });

    return res.status(201).json({
      message: 'Pedido criado com sucesso',
      pedidoId: order._id,
    });
  } catch (err) {
    console.error('[orderController.create]', err);
    return res.status(500).json({
      error: 'Erro ao criar pedido',
      details: err.message,
    });
  }
};

/**
 * GET /api/orders/myorders
 * Pedidos do usuário logado
 */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const orders = await Order.find({ clienteId: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(orders);
  } catch (err) {
    console.error('[orderController.getMyOrders]', err);
    return res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
};

/**
 * GET /api/orders/company
 * Pedidos da empresa logada
 */
exports.getCompanyOrders = async (req, res) => {
  try {
    const companyId = getUserId(req);
    if (!companyId) {
      return res.status(401).json({ error: 'Empresa não autenticada' });
    }

    const orders = await Order.find({ empresaId: companyId })
      .populate('clienteId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(orders);
  } catch (err) {
    console.error('[orderController.getCompanyOrders]', err);
    return res.status(500).json({ error: 'Erro ao buscar pedidos da empresa' });
  }
};

/**
 * GET /api/orders/:pedidoId/status
 */
exports.getOrderStatus = async (req, res) => {
  try {
    const { pedidoId } = req.params;

    const order = await Order.findById(pedidoId).select('deliveryStatus');
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    return res.json({ status: order.deliveryStatus });
  } catch (err) {
    console.error('[orderController.getOrderStatus]', err);
    return res.status(500).json({ error: 'Erro ao consultar status' });
  }
};

/**
 * PUT /api/orders/:pedidoId/status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }

    const order = await Order.findById(pedidoId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    order.deliveryStatus = normalizeStatus(status);
    await order.save();

    return res.json({
      message: 'Status atualizado com sucesso',
      status: order.deliveryStatus,
    });
  } catch (err) {
    console.error('[orderController.updateOrderStatus]', err);
    return res.status(500).json({ error: 'Erro ao atualizar status' });
  }
};
