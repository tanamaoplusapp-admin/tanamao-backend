// routes/orderRoutes.js
const express = require('express');
const router = express.Router();

/* =======================
 * Middleware de Auth
 * ======================= */
let verifyToken, requireRoles;
try {
  const m = require('../middleware/verifyToken');
  verifyToken = m.verifyToken || m;
  requireRoles =
    m.requireRoles || (() => (_req, _res, next) => next());
} catch (err) {
  console.warn('[orderRoutes] auth middleware não encontrado, usando fallback');
  verifyToken = (_req, _res, next) => next();
  requireRoles = () => (_req, _res, next) => next();
}

/* =======================
 * Controller (COM GUARDA)
 * ======================= */
const orderCtrl = require('../controllers/orderController') || {};

// 🔒 Garantia: nunca passar undefined para o Express
const safe =
  (fn, name) =>
  typeof fn === 'function'
    ? fn
    : (_req, res) =>
        res.status(500).json({
          error: `Handler ${name} não implementado`,
        });

const createOrderAfterPayment = safe(
  orderCtrl.createOrderAfterPayment,
  'createOrderAfterPayment'
);
const updateOrderStatus = safe(
  orderCtrl.updateOrderStatus,
  'updateOrderStatus'
);
const getOrderStatus = safe(
  orderCtrl.getOrderStatus,
  'getOrderStatus'
);
const getMyOrders = safe(
  orderCtrl.getMyOrders,
  'getMyOrders'
);
const getCompanyOrders = safe(
  orderCtrl.getCompanyOrders,
  'getCompanyOrders'
);

/* =====================================================
 * ROTAS
 * ===================================================== */

/**
 * POST /api/orders
 * Criação de pedido após pagamento (PIX / cartão / webhook)
 * (pode ser chamada sem token)
 */
router.post('/', createOrderAfterPayment);

/**
 * GET /api/orders/myorders
 * Pedidos do usuário logado (cliente)
 */
router.get('/myorders', verifyToken, getMyOrders);

/**
 * GET /api/orders/company
 * Pedidos da empresa logada
 */
router.get(
  '/company',
  verifyToken,
  requireRoles('empresa'),
  getCompanyOrders
);

/**
 * GET /api/orders/:pedidoId/status
 * Consulta status do pedido
 */
router.get('/:pedidoId/status', getOrderStatus);

/**
 * PUT /api/orders/:pedidoId/status
 * Atualiza status do pedido
 */
router.put(
  '/:pedidoId/status',
  verifyToken,
  requireRoles('empresa', 'admin'),
  updateOrderStatus
);

module.exports = router;
