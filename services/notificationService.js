const Notification = require('../models/Notification');
const User = require('../models/user');
const { enviarPushParaUsuario } = require('./pushService');

/* =========================================================
   NORMALIZAR PAYLOAD PARA PUSH
========================================================= */
function normalizePushData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value == null ? '' : String(value),
    ])
  );
}

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
       INCREMENTAR CONTADOR DE NÃO LIDAS
    ===================================================== */
    await User.findByIdAndUpdate(userId, {
      $inc: { unreadNotifications: 1 },
    });

    /* =====================================================
       BUSCAR USUÁRIO PARA PUSH
    ===================================================== */
    const user = await User.findById(userId)
      .select('fcmToken pushEnabled')
      .lean();

    /* =====================================================
       ENVIAR PUSH VIA FCM
    ===================================================== */
    if (user?.fcmToken && user?.pushEnabled) {
      try {
        const pushData = normalizePushData({
          type,
          relatedId,
          notificationId: notification?._id,
          ...payload,
        });

        await enviarPushParaUsuario(userId, {
          title: title || 'Notificação',
          body: message || '',
          data: pushData,
        });
      } catch (err) {
        console.error(
          '[notificationService.push]',
          err?.message || err
        );
      }
    } else {
      console.log(
        '[notificationService.push] Push não enviado:',
        {
          userId,
          hasToken: !!user?.fcmToken,
          pushEnabled: !!user?.pushEnabled,
        }
      );
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