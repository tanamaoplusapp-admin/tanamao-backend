// controllers/notificationController.js

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Profissional = require('../models/Profissional');
const User = require('../models/user');

const resolveUserId = (req) => {
  const maybe =
    req.user?.userId ||
    req.userId ||
    req.user?.id ||
    req.user?.sub ||
    null;

  if (!maybe) return null;

  return mongoose.Types.ObjectId.isValid(maybe)
    ? mongoose.Types.ObjectId(maybe)
    : String(maybe);
};

/* =========================================================
   LISTAR MINHAS NOTIFICAÇÕES
========================================================= */

exports.listMine = async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId)
      return res
        .status(401)
        .json({ ok: false, message: 'Não autenticado' });

    console.log(
      '[notification.listMine] token payload:',
      req.user || req.userId
    );

    console.log(
      '[notification.listMine] resolved userId:',
      userId
    );

    const profissional = await Profissional
      .findOne({ userId })
      .lean();

    if (!profissional) {

      console.warn(
        '[notification.listMine] profissional não encontrado para userId:',
        userId
      );

      return res.status(404).json({
        ok: false,
        error: 'Profissional não encontrado.',
      });
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

    if (!userId)
      return res
        .status(401)
        .json({ ok: false, message: 'Não autenticado' });

    console.log(
      '[notification.markRead] token payload:',
      req.user || req.userId
    );

    console.log(
      '[notification.markRead] resolved userId:',
      userId,
      'notificationId:',
      req.params.id
    );

    const profissional = await Profissional
      .findOne({ userId })
      .lean();

    if (!profissional) {

      console.warn(
        '[notification.markRead] profissional não encontrado para userId:',
        userId
      );

      return res.status(404).json({
        ok: false,
        error: 'Profissional não encontrado.',
      });
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

      console.warn(
        '[notification.markRead] nenhuma notificação encontrada para atualizar',
        { id: req.params.id, userId }
      );

      return res.status(404).json({
        ok: false,
        message: 'Notificação não encontrada.',
      });
    }

    /* =========================================================
       ATUALIZA CONTADOR DE NOTIFICAÇÕES
    ========================================================= */

    await User.findByIdAndUpdate(userId, {
      $inc: { unreadNotifications: -1 }
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
}) => {

  try {

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      chatId,
      servicoId,
      read: false,
      createdAt: new Date(),
    });

    /* =========================================================
       INCREMENTA CONTADOR DE NOTIFICAÇÕES
    ========================================================= */

    await User.findByIdAndUpdate(userId, {
      $inc: { unreadNotifications: 1 }
    });

    return notification;

  } catch (err) {

    console.error(
      '[notification.createNotification]',
      err
    );

    return null;

  }
};