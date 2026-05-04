const express = require('express');
const rateLimit = require('express-rate-limit');
const { Types } = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
const chatController = require('../controllers/chatController');

const {
  criarChat,
  buscarChatsDoUsuario,
  enviarMensagem,
  listarMensagens,
  marcarComoLido,
  buscarChatPorId,
} = chatController;

if (typeof criarChat !== 'function') {
  throw new Error('[chatRoutes] criarChat não exportado corretamente do chatController.');
}

if (typeof buscarChatsDoUsuario !== 'function') {
  throw new Error('[chatRoutes] buscarChatsDoUsuario não exportado corretamente do chatController.');
}

if (typeof enviarMensagem !== 'function') {
  throw new Error('[chatRoutes] enviarMensagem não exportado corretamente do chatController.');
}

if (typeof listarMensagens !== 'function') {
  throw new Error('[chatRoutes] listarMensagens não exportado corretamente do chatController.');
}

if (typeof marcarComoLido !== 'function') {
  throw new Error('[chatRoutes] marcarComoLido não exportado corretamente do chatController.');
}

if (typeof buscarChatPorId !== 'function') {
  throw new Error('[chatRoutes] buscarChatPorId não exportado corretamente do chatController.');
}

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

/* ================= UPLOAD FOTO CHAT ================= */

const uploadDir = path.resolve(process.cwd(), 'uploads', 'chat');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const chatPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    const filename = `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

const uploadChatPhoto = multer({
  storage: chatPhotoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são permitidas'));
    }

    cb(null, true);
  },
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
 * Upload de foto do chat
 * POST /api/chat/:chatId/upload-foto
 */
router.post(
  '/:chatId/upload-foto',
  verifyToken,
  uploadChatPhoto.single('foto'),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhuma foto enviada' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const url = `${baseUrl}/uploads/chat/${req.file.filename}`;

      return res.status(201).json({
        url,
        fotoUrl: url,
      });
    } catch (error) {
      console.error('[chatRoutes] Erro ao fazer upload da foto:', error);
      return res.status(500).json({ error: 'Erro ao enviar foto' });
    }
  }
);

/**
 * Buscar chat por ID
 * GET /api/chat/:chatId
 */
router.get('/:chatId', verifyToken, buscarChatPorId);

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
router.get('/:chatId/mensagens', verifyToken, listarMensagens);

/**
 * Marcar mensagens como lidas
 * PATCH /api/chat/:chatId/lido
 */
router.patch('/:chatId/lido', verifyToken, marcarComoLido);

module.exports = router;