const admin = require('firebase-admin');
const User = require('../models/user');

function normalizeData(data = {}) {
  const normalized = {};

  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      normalized[key] = String(value);
    }
  });

  return normalized;
}

async function enviarPushParaUsuario(userId, payload = {}) {
  try {
    const user = await User.findById(userId);

    if (!user || !user.fcmToken || user.pushEnabled === false) {
      console.log('[PUSH] Usuário sem token ou push desativado:', userId);
      return false;
    }

    const title = payload.title || 'Tanamão+';
    const body = payload.body || payload.message || 'Você tem uma nova notificação';

    const data = normalizeData({
      ...(payload.data || {}),
      type: payload.type || payload.data?.type || 'notification',
      notificationId: payload.notificationId,
      chatId: payload.chatId,
      serviceId: payload.serviceId || payload.servicoId,
      servicoId: payload.servicoId || payload.serviceId,
    });

    const message = {
      token: user.fcmToken,

      notification: {
        title,
        body,
      },

      data,

      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
          visibility: 'public',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },

      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: user.unreadNotifications || 1,
            contentAvailable: true,
          },
        },
      },
    };

    await admin.messaging().send(message);

    console.log('[PUSH] Enviada para usuário:', userId);
    return true;
  } catch (err) {
    console.error('[PUSH] Erro ao enviar push:', err.message);

    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      await User.findByIdAndUpdate(userId, {
        $unset: { fcmToken: '' },
      });

      console.log('[PUSH] Token inválido removido do usuário:', userId);
    }

    return false;
  }
}

module.exports = { enviarPushParaUsuario };