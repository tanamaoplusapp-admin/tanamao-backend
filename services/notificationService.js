// services/notificationService.js

const axios = require('axios');

const Notification = require('../models/Notification');
const User = require('../models/user');

/* =========================================================
   ENVIAR NOTIFICAÇÃO COMPLETA
========================================================= */

exports.sendNotification = async ({
  userId,
  type,
  title,
  message,
  relatedId = null,
  payload = {},
  urgente = false,
}) => {
  try {

    /* =====================================================
       SALVAR NOTIFICAÇÃO NO BANCO
    ===================================================== */

    const notification = await Notification.create({
      userId,
      type,
      relatedId,
      payload,
      urgente,
      read: false,
      createdAt: new Date(),
    });

    /* =====================================================
       INCREMENTAR CONTADOR DE NOTIFICAÇÕES
    ===================================================== */

    await User.findByIdAndUpdate(userId, {
      $inc: { unreadNotifications: 1 },
    });

    /* =====================================================
       BUSCAR USUÁRIO PARA PUSH
    ===================================================== */

    const user = await User.findById(userId)
      .select('fcmToken pushEnabled online')
      .lean();

    if (
      user?.fcmToken &&
      user?.pushEnabled &&
      !user?.online
    ) {

      try {

        await axios.post(
          'https://exp.host/--/api/v2/push/send',
          {
            to: user.fcmToken,
            sound: 'default',
            title,
            body: message,
            data: {
              type,
              relatedId,
              ...payload,
            },
          }
        );

      } catch (err) {

        console.error(
          '[notificationService.push]',
          err?.response?.data || err
        );

      }

    }

    return notification;

  } catch (err) {

    console.error(
      '[notificationService.sendNotification]',
      err
    );

    return null;

  }
};