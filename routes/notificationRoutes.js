const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const c = require('../controllers/notificationController');

/* =========================================================
   LISTAR MINHAS NOTIFICAÇÕES
   GET /api/notifications
========================================================= */

router.get('/', verifyToken, c.listMine);

/* =========================================================
   MARCAR NOTIFICAÇÃO COMO LIDA
   PUT /api/notifications/:id/read
========================================================= */

router.put('/:id/read', verifyToken, c.markRead);

/* =========================================================
   MARCAR TODAS COMO LIDAS
   PUT /api/notifications/read-all
========================================================= */

router.put('/read-all', verifyToken, async (req, res) => {
  try {

    const userId =
      req.user?.userId ||
      req.userId ||
      req.user?.id ||
      req.user?.sub;

    if (!userId)
      return res
        .status(401)
        .json({ ok: false, message: 'Não autenticado' });

    const Notification = require('../models/Notification');

    await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );

    return res.json({ ok: true });

  } catch (err) {

    console.error('notification.readAll error', err);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao marcar notificações',
    });

  }
});

module.exports = router;