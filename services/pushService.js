const admin = require('./firebaseAdmin');
const User = require('../models/user');

/* =========================================================
   NORMALIZAR DATA PAYLOAD PARA FCM
   FCM exige values em string no campo data
========================================================= */
function normalizeDataPayload(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value == null ? '' : String(value),
    ])
  );
}

/* =========================================================
   ENVIAR PUSH PARA USUÁRIO
========================================================= */
exports.enviarPushParaUsuario = async (userId, payload = {}) => {
  try {
    if (!admin || !admin.messaging) {
      console.log('[PUSH] Firebase não inicializado');
      return false;
    }

    const user = await User.findById(userId)
      .select('fcmToken pushEnabled')
      .lean();

    if (!user) {
      console.log('[PUSH] Usuário não encontrado');
      return false;
    }

    if (!user.pushEnabled) {
      console.log('[PUSH] Push desabilitado para o usuário');
      return false;
    }

    if (!user.fcmToken) {
      console.log('[PUSH] Usuário sem token');
      return false;
    }

    const normalizedData = normalizeDataPayload(payload.data || {});
    const title = payload.title || 'Notificação';
    const body = payload.body || '';

    const message = {
      token: user.fcmToken,

      notification: {
        title,
        body,
      },

      data: normalizedData,

      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
        },
      },

      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);

    console.log('[PUSH] Enviado com sucesso:', {
      userId,
      messageId: response,
      type: normalizedData.type || null,
    });

    return true;
  } catch (error) {
    console.log('[PUSH ERROR]', {
      userId,
      code: error?.code || null,
      message: error?.message || 'Erro desconhecido',
    });

    if (
      error?.code === 'messaging/registration-token-not-registered' ||
      error?.code === 'messaging/invalid-registration-token'
    ) {
      await User.findByIdAndUpdate(userId, {
        fcmToken: null,
      });

      console.log('[PUSH] Token inválido removido do usuário');
    }

    return false;
  }
};