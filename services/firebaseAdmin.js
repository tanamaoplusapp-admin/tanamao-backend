// services/firebaseAdmin.js
const admin = require('firebase-admin');
const config = require('../config/env');

const ENABLED = !!(config.firebase && config.firebase.enabled);

if (!ENABLED) {
  console.log('🔕 Firebase desabilitado (FIREBASE_ENABLED != true)');
  module.exports = null;
  return;
}

// Tenta inicializar com credenciais do .env (service account via variáveis)
const missing = [];
if (!config.firebase.projectId)  missing.push('FIREBASE_PROJECT_ID');
if (!config.firebase.clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
if (!config.firebase.privateKey)  missing.push('FIREBASE_PRIVATE_KEY');

try {
  if (missing.length) {
    // Se faltar algo no .env, tenta fallback via GOOGLE_APPLICATION_CREDENTIALS
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.warn(`⚠️ Firebase inicializado com GOOGLE_APPLICATION_CREDENTIALS. Ausentes no .env: ${missing.join(', ')}`);
    } else {
      console.warn(`⚠️ Firebase não inicializado. Faltando no .env: ${missing.join(', ')}`);
      module.exports = null;
      return;
    }
  } else {
    // Credenciais completas via .env (chave já vem normalizada no env: .replace(/\\n/g, '\n'))
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id:  config.firebase.projectId,
        client_email: config.firebase.clientEmail,
        private_key:  config.firebase.privateKey,
      }),
      projectId: config.firebase.projectId,
    });
    console.log('✅ Firebase Admin inicializado');
  }

  // Helpers opcionais (não quebra se Firestore/Messaging não estiverem habilitados no projeto)
  try {
    const firestore = admin.firestore();
    // Evita erros com campos undefined nos writes
    if (firestore && firestore.settings) {
      firestore.settings({ ignoreUndefinedProperties: true });
    }
    module.exports = admin;
    module.exports.firestore = firestore || null;
  } catch {
    module.exports = admin;
    module.exports.firestore = null;
  }

  try {
    module.exports.messaging = admin.messaging();
  } catch {
    module.exports.messaging = null;
  }
} catch (e) {
  console.error('❌ Erro ao iniciar Firebase Admin:', e.message);
  module.exports = null; // não derruba o servidor
}
