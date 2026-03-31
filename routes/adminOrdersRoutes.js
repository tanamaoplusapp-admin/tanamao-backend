const express = require('express');
const router = express.Router();

const Order = require('../models/order');

/**
 * GET /api/admin/orders
 */
router.get('/orders', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error('[ADMIN ORDERS]', err);
    res.status(500).json({ message: 'Erro ao listar pedidos' });
  }
});

/**
 * GET /api/admin/orders/:id
 */
router.get('/orders/:id', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    res.json(order);
  } catch (err) {
    console.error('[ADMIN ORDER DETAIL]', err);
    res.status(500).json({ message: 'Erro ao buscar pedido' });
  }
});

module.exports = router;
