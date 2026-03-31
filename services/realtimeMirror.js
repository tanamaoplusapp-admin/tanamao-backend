// services/firestoreMirror.js
// Espelha chats e mensagens no Firestore (p/ push em tempo real no app).
// Funciona mesmo se o Firebase estiver desabilitado: vira no-op silencioso.

const admin = require('./firebaseAdmin'); // esse módulo exporta o "admin" ou null

// memoize para não inicializar toda hora
let _db = null;
let _warned = false;

function getDb() {
  if (_db) return _db;
  if (!admin || !admin.firestore) {
    if (!_warned) {
      console.log('🔕 Firestore mirror desabilitado (Firebase Admin não inicializado).');
      _warned = true;
    }
    return null;
  }
  _db = admin.firestore();
  return _db;
}

// coleções
const CF = {
  chats: 'chats',
  mensagens: (chatId) => `chats/${chatId}/mensagens`,
};

// helpers
const toStr = (v) => (v == null ? null : String(v));
const arrIds = (a) => (Array.isArray(a) ? a.map((x) => toStr(x)).filter(Boolean) : []);

function now() {
  try {
    const db = getDb();
    return db ? admin.firestore.FieldValue.serverTimestamp() : new Date();
  } catch {
    return new Date();
  }
}

/**
 * 🔄 Sobe/atualiza o documento do chat no Firestore.
 * Compatível com seu schema:
 *   Chat: { participantes: [ObjectId], ultimoTexto, atualizadoEm, createdAt/updatedAt }
 */
async function mirrorChatUpsert(chat) {
  const db = getDb();
  if (!db) return { skipped: true };

  const chatId = toStr(chat._id);
  if (!chatId) return { skipped: true, reason: 'chat sem _id' };

  const ref = db.collection(CF.chats).doc(chatId);

  // mapeia campos do seu schema para o Firestore
  const payload = {
    _id: chatId,
    participantes: arrIds(chat.participantes),
    ultimoTexto: chat.ultimoTexto || null,
    atualizadoEm: chat.atualizadoEm || chat.updatedAt || now(),
    createdAt: chat.createdAt || now(),
    updatedAt: chat.updatedAt || now(),
  };

  await ref.set(payload, { merge: true });
  return { ok: true, chatId };
}

/**
 * 📨 Acrescenta uma mensagem no subcollection /chats/{chatId}/mensagens
 * Compatível com seu schema:
 *   Mensagem: { chatId, remetente, texto, imagemUrl, enviadoEm, createdAt/updatedAt }
 * Além disso, atualiza "ultimoTexto" e "atualizadoEm" do chat pai.
 */
async function mirrorMessageAppend(msg) {
  const db = getDb();
  if (!db) return { skipped: true };

  const chatId = toStr(msg.chatId || msg.chat);
  const msgId = toStr(msg._id);
  if (!chatId || !msgId) return { skipped: true, reason: 'mensagem sem chatId/_id' };

  const msgRef = db.collection(CF.mensagens(chatId)).doc(msgId);

  const payload = {
    _id: msgId,
    chatId,
    remetente: toStr(msg.remetente || msg.sender),
    texto: msg.texto || msg.text || '',
    imagemUrl: msg.imagemUrl || msg.imageUrl || null,
    enviadoEm: msg.enviadoEm || msg.createdAt || now(),
    createdAt: msg.createdAt || now(),
    updatedAt: msg.updatedAt || now(),
  };

  await msgRef.set(payload, { merge: false });

  // Atualiza cabeçalho do chat (ultimoTexto / atualizadoEm)
  const chatRef = db.collection(CF.chats).doc(chatId);
  await chatRef.set(
    {
      ultimoTexto: payload.texto || (payload.imagemUrl ? '[Imagem]' : ''),
      atualizadoEm: now(),
      updatedAt: now(),
    },
    { merge: true }
  );

  return { ok: true, chatId, msgId };
}

/**
 * 👀 Marca leitura no Firestore (não altera seu Mongo).
 * Mantém um mapa "leitura.{userId}: timestamp" só no Firestore
 * para consumo do app em tempo real (se necessário).
 */
async function mirrorChatRead(chatIdRaw, userIdRaw) {
  const db = getDb();
  if (!db) return { skipped: true };

  const chatId = toStr(chatIdRaw);
  const userId = toStr(userIdRaw);
  if (!chatId || !userId) return { skipped: true, reason: 'ids inválidos' };

  const chatRef = db.collection(CF.chats).doc(chatId);
  await chatRef.set(
    { leitura: { [userId]: now() }, updatedAt: now() },
    { merge: true }
  );

  return { ok: true, chatId, userId };
}

module.exports = {
  mirrorChatUpsert,
  mirrorMessageAppend,
  mirrorChatRead,
};
