// controllers/notificationController.js

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/user');
const { enviarPushParaUsuario } = require('../services/pushService');

const resolveUserId = (req) => {
  const maybe =
    req.user?.userId ||
    req.userId ||
    req.user?.id ||
    req.user?.sub ||
    null;

  if (!maybe) return null;

  return mongoose.Types.ObjectId.isValid(maybe)
    ? new mongoose.Types.ObjectId(maybe)
    : String(maybe);
};

/* =========================================================
   LISTAR MINHAS NOTIFICAÇÕES
========================================================= */

exports.listMine = async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: 'Não autenticado' });
    }

    const items = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      ok: true,
      items,
    });
  } catch (err) {
    console.error('notification.listMine error', err);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar notificações',
      details: err.message,
    });
  }
};

/* =========================================================
   MARCAR COMO LIDA
========================================================= */

exports.markRead = async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, message: 'Não autenticado' });
    }

    const result = await Notification.updateOne(
      {
        _id: req.params.id,
        userId,
      },
      {
        $set: { read: true },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Notificação não encontrada.',
      });
    }

    await User.findByIdAndUpdate(userId, {
      $inc: { unreadNotifications: -1 },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('notification.markRead error', err);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao marcar leitura',
      details: err.message,
    });
  }
};

/* =========================================================
   CRIAR NOTIFICAÇÃO (USO INTERNO DO SISTEMA)
========================================================= */

exports.createNotification = async ({
  userId,
  type,
  title,
  message,
  chatId = null,
  servicoId = null,
  serviceId = null,
  urgente = false,
  payload = {},
  relatedId = null,
}) => {
  try {
    const finalServicoId = servicoId || serviceId || null;

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      chatId,
      servicoId: finalServicoId,
      urgente,
      payload,
      relatedId,
      read: false,
      createdAt: new Date(),
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { unreadNotifications: 1 },
      },
      { new: true }
    );

    try {
      await enviarPushParaUsuario(userId, {
        title: title || 'Tanamão+',
        body: message || 'Você tem uma nova notificação',
        type,
        notificationId: notification._id,
        chatId,
        servicoId: finalServicoId,
        serviceId: finalServicoId,
        unreadNotifications: updatedUser?.unreadNotifications || 1,
        data: {
          type,
          notificationId: notification._id,
          chatId,
          servicoId: finalServicoId,
          serviceId: finalServicoId,
          relatedId,
          urgente,
          ...payload,
        },
      });
    } catch (pushErr) {
      console.error('[notification.createNotification.push]', pushErr);
    }

    return notification;
  } catch (err) {
    console.error('[notification.createNotification]', err);
    return null;
  }
};