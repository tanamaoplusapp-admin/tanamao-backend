const admin = require('./firebaseAdmin');
const User = require('../models/user');

exports.enviarPushParaUsuario = async (userId, payload) => {
  try {
    if (!admin || !admin.messaging) {
      console.log('⚠️ Firebase não inicializado');
      return;
    }

    const user = await User.findById(userId).select('fcmToken');

    if (!user || !user.fcmToken) {
      console.log('[PUSH] Usuário sem token');
      return;
    }

    await admin.messaging().send({
      token: user.fcmToken,

      notification: {
        title: payload.title || 'Notificação',
        body: payload.body || '',
      },

      data: payload.data || {},
    });

    console.log('[PUSH] Enviado com sucesso');

  } catch (error) {
    console.log('[PUSH ERROR]', error.message);

    // 🔥 tratamento profissional
    if (
      error.code ===
      'messaging/registration-token-not-registered'
    ) {
      await User.findByIdAndUpdate(userId, {
        fcmToken: null,
      });

      console.log('[PUSH] Token inválido removido');
    }
  }
};