const express = require('express');
const rateLimit = require('express-rate-limit');
const { Types } = require('mongoose');

const router = express.Router();

/* ================= AUTH ================= */
let verifyToken;

try {
  const auth = require('../middleware/verifyToken');
  verifyToken = auth.verifyToken;
} catch (_) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken || auth;
  } catch (_) {
    verifyToken = null;
  }
}

if (typeof verifyToken !== 'function') {
  throw new Error('[chatRoutes] Middleware de autenticação não encontrado.');
}

/* ================= CONTROLLER ================= */
const {
  criarChat,
  buscarChatsDoUsuario,
  enviarMensagem,
  listarMensagens,
  marcarComoLido,
} = require('../controllers/chatController');

/* ================= RATE LIMIT ================= */

const createChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const sendMessageLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ================= VALIDAÇÃO PARAM ================= */

router.param('chatId', (req, res, next, val) => {
  if (!Types.ObjectId.isValid(String(val))) {
    return res.status(400).json({ error: 'chatId inválido' });
  }
  return next();
});

/* ======================================================
   ROTAS
====================================================== */

/**
 * Criar chat
 * POST /api/chat
 */
router.post('/', verifyToken, createChatLimiter, criarChat);

/**
 * Listar chats do usuário
 * GET /api/chat/meus
 */
router.get('/meus', verifyToken, buscarChatsDoUsuario);

/**
 * Enviar mensagem
 * POST /api/chat/:chatId/mensagem
 */
router.post(
  '/:chatId/mensagem',
  verifyToken,
  sendMessageLimiter,
  enviarMensagem
);

/**
 * Listar mensagens
 * GET /api/chat/:chatId/mensagens
 */
router.get(
  '/:chatId/mensagens',
  verifyToken,
  listarMensagens
);

/**
 * Marcar mensagens como lidas
 * PATCH /api/chat/:chatId/lido
 */
router.patch(
  '/:chatId/lido',
  verifyToken,
  marcarComoLido
);

module.exports = router;