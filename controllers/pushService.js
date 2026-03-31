const admin = require('firebase-admin');
const User = require('../models/user');

async function enviarPushParaUsuario(userId, payload) {
  const user = await User.findById(userId);

  if (!user || !user.fcmToken || user.pushEnabled === false) {
    return;
  }

  const message = {
    token: user.fcmToken,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
  };

  try {
    await admin.messaging().send(message);
    console.log('📲 Push enviada para', userId);
  } catch (err) {
    console.error('❌ Erro ao enviar push:', err.message);
  }
}

module.exports = { enviarPushParaUsuario };