// utils/chatUtils.js
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit as qLimit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig'; // ajuste se necessário

const mensagensRef = (chatId) => collection(db, 'chats', String(chatId), 'mensagens');

/**
 * Envia mensagem para o Firestore.
 * Aceita: { texto, imagemUrl, remetente } — pelo menos texto OU imagemUrl.
 * Cria createdAt/updatedAt com serverTimestamp() para ordenar em tempo real.
 */
export const enviarMensagemParaFirestore = async (
  chatId,
  { texto, imagemUrl = null, remetente = null } = {}
) => {
  if (!chatId) throw new Error('chatId é obrigatório');
  if (!texto && !imagemUrl) throw new Error('Envie "texto" ou "imagemUrl".');

  const payload = {
    texto: texto || '',
    imagemUrl: imagemUrl || null,
    remetente: remetente || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await addDoc(mensagensRef(chatId), payload);
    return true;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
};

/**
 * Escuta mensagens em tempo real do chat.
 * @param {string} chatId
 * @param {(msgs: any[]) => void} callback
 * @param {{ ordenarPor?: 'createdAt'|'enviadoEm', direcao?: 'asc'|'desc', max?: number }} [opts]
 */
export const ouvirMensagens = (
  chatId,
  callback,
  { ordenarPor = 'createdAt', direcao = 'asc', max = 200 } = {}
) => {
  if (!chatId) throw new Error('chatId é obrigatório');

  const q = query(mensagensRef(chatId), orderBy(ordenarPor, direcao), qLimit(max));

  return onSnapshot(
    q,
    (snapshot) => {
      const mensagens = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(mensagens);
    },
    (err) => {
      console.error('Erro ao ouvir mensagens:', err);
    }
  );
};
