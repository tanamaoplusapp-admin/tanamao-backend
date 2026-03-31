const express = require('express');
const router = express.Router();

const User = require('../models/user');

/**
 * GET /api/admin/users
 * Lista todos os usuários (admin)
 */
router.get('/users', async (req, res) => {
  try {
    // segurança extra (opcional)
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    console.error('[ADMIN USERS]', err);
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
});

/**
 * PATCH /api/admin/users/:id/toggle-status
 */
router.patch('/users/:id/toggle-status', async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    user.active = !user.active;
    await user.save();

    res.json({
      message: 'Status atualizado',
      active: user.active,
    });
  } catch (err) {
    console.error('[ADMIN USERS TOGGLE]', err);
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

module.exports = router;
