// routes/notificationRoutes.js

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const c = require('../controllers/notificationController');

const resolveUserId = (req) => {
  return (
    req.user?.userId ||
    req.userId ||
    req.user?.id ||
    req.user?.sub ||
    null
  );
};

/* =========================================================
   LISTAR MINHAS NOTIFICAÇÕES
   GET /api/notifications
========================================================= */

router.get('/', verifyToken, c.listMine);

/* =========================================================
   MARCAR TODAS COMO LIDAS
   PUT /api/notifications/read-all
========================================================= */

router.put('/read-all', verifyToken, async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado',
      });
    }

    const Notification = require('../models/Notification');
    const User = require('../models/user');

    await Notification.updateMany(
      {
        userId,
        read: false,
      },
      {
        $set: {
          read: true,
        },
      }
    );

    await User.findByIdAndUpdate(userId, {
      $set: {
        unreadNotifications: 0,
      },
    });

    return res.json({
      ok: true,
      message: 'Todas as notificações foram marcadas como lidas.',
    });
  } catch (err) {
    console.error('notification.readAll error', err);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao marcar notificações',
      details: err.message,
    });
  }
});

/* =========================================================
   MARCAR NOTIFICAÇÃO COMO LIDA
   PUT /api/notifications/:id/read
========================================================= */

router.put('/:id/read', verifyToken, c.markRead);

module.exports = router;