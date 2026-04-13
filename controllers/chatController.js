// controllers/chatController.js

const mongoose = require('mongoose');
const axios = require('axios');

const Chat = require('../models/Chat');
const Mensagem = require('../models/Mensagem');
const User = require('../models/user');

const { sendNotification } = require('../services/notificationService');

const isObjectId = (v) =>
  mongoose.Types.ObjectId.isValid(String(v));

const getUserId = (req) =>
  req.userId || req.user?.id || req.user?._id;

/* =========================================================
   CRIAR CHAT
========================================================= */

exports.criarChat = async (req, res) => {
  try {

    const remetenteId = getUserId(req);
    const { destinatarioId } = req.body || {};

    if (!remetenteId)
      return res.status(401).json({ error: 'Não autenticado' });

    if (!isObjectId(destinatarioId))
      return res.status(400).json({ error: 'destinatarioId inválido.' });

    if (String(remetenteId) === String(destinatarioId))
      return res.status(400).json({
        error: 'Não é possível criar chat consigo mesmo.'
      });

    /* ===============================
       1 CLIENTE + 1 PRESTADOR = 1 CHAT
    =============================== */

    let chat = await Chat.findOne({
      participantes: {
        $all: [remetenteId, destinatarioId]
      }
    });

    if (chat) {
      return res.json(chat);
    }

    chat = await Chat.create({
      participantes: [remetenteId, destinatarioId],
      ultimoTexto: '',
      atualizadoEm: new Date(),
    });

    return res.status(201).json(chat);

  } catch (error) {

    console.error('criarChat erro:', error);

    return res.status(500).json({
      error: 'Erro ao criar chat'
    });

  }
};

/* =========================================================
   LISTAR CHATS DO USUÁRIO
========================================================= */

exports.buscarChatsDoUsuario = async (req, res) => {
  try {

    const userId = getUserId(req);

    if (!userId)
      return res.status(401).json({ error: 'Não autenticado' });

    const chats = await Chat.find({
      participantes: userId,
    })
      .populate('participantes', 'name online')
      .sort({ atualizadoEm: -1, updatedAt: -1 })
      .lean();

    const chatsComResumo = await Promise.all(
      chats.map(async (chat) => {

        const naoLidas = await Mensagem.countDocuments({
          chatId: chat._id,
          remetente: { $ne: userId },
          lidoPor: { $ne: userId },
        });

        const ultimaMensagem = await Mensagem.findOne({
          chatId: chat._id,
        })
          .sort({ enviadoEm: -1 })
          .select('texto remetente enviadoEm')
          .lean();

        return {
          ...chat,
          naoLidas,
          ultimaMensagem: ultimaMensagem || null,
        };

      })
    );

    return res.json(chatsComResumo);

  } catch (error) {

    console.error('buscarChatsDoUsuario erro:', error);

    return res.status(500).json({
      error: 'Erro ao buscar chats'
    });

  }
};

/* =========================================================
   ENVIAR MENSAGEM
========================================================= */

exports.enviarMensagem = async (req, res) => {
  try {

    const remetenteId = getUserId(req);

    if (!remetenteId)
      return res.status(401).json({ error: 'Não autenticado' });

    const { chatId } = req.params;
    const { texto, imagemUrl } = req.body || {};

    if (!isObjectId(chatId))
      return res.status(400).json({ error: 'chatId inválido.' });

    if (!texto && !imagemUrl)
      return res.status(400).json({ error: 'Mensagem vazia.' });

    const chat = await Chat.findById(chatId);

    if (!chat)
      return res.status(404).json({ error: 'Chat não encontrado' });

    const participa = chat.participantes.some(
      (p) => String(p) === String(remetenteId)
    );

    if (!participa)
      return res.status(403).json({
        error: 'Você não participa deste chat.'
      });

    const novaMensagem = await Mensagem.create({
      chatId,
      remetente: remetenteId,
      texto: (texto || '').trim(),
      imagemUrl: imagemUrl || null,
      enviadoEm: new Date(),
      lidoPor: [remetenteId],
    });

    await Chat.findByIdAndUpdate(chatId, {
      ultimoTexto: texto?.trim() || '[Imagem]',
      atualizadoEm: new Date(),
      ultimoRemetente: remetenteId,
      $currentDate: { updatedAt: true },
    });

    const io = req.app.get('io');

    if (io) {
 // ✅ NOVO: envia para sala do chat (tempo real correto)
  io.to(String(chatId)).emit(
    'nova_mensagem',
    novaMensagem
  );
      chat.participantes.forEach((userId) => {

        if (String(userId) !== String(remetenteId)) {

          io.to(String(userId)).emit(
            'nova_mensagem',
            novaMensagem
          );

        }

      });

    }

    return res.status(201).json(novaMensagem);

  } catch (error) {

    console.error('enviarMensagem erro:', error);

    return res.status(500).json({
      error: 'Erro ao enviar mensagem'
    });

  }
};

/* =========================================================
   LISTAR MENSAGENS
========================================================= */

exports.listarMensagens = async (req, res) => {
  try {

    const userId = getUserId(req);

    const { chatId } = req.params;

    const mensagens = await Mensagem.find({ chatId })
      .sort({ enviadoEm: 1, createdAt: 1 })
      .lean();

    return res.json(mensagens);

  } catch (error) {

    return res.status(500).json({
      error: 'Erro ao buscar mensagens'
    });

  }
};

/* =========================================================
   MARCAR COMO LIDO
========================================================= */

exports.marcarComoLido = async (req, res) => {
  try {

    const userId =
      req.userId ||
      req.user?.id ||
      req.user?._id;

    const { chatId } = req.params;

    const mensagens = await Mensagem.find({
      chatId: chatId
    });

    for (const msg of mensagens) {

      // ignora mensagens enviadas por mim
      if (msg.remetente.toString() === userId.toString()) {
        continue;
      }

      const jaLeu = msg.lidoPor.some(
        (id) => id.toString() === userId.toString()
      );

      if (!jaLeu) {
        msg.lidoPor.push(userId);
        await msg.save();
      }

    }

    return res.json({ ok: true });

  } catch (error) {

    console.error('marcarComoLido erro:', error);

    return res.status(500).json({
      error: 'Erro ao marcar mensagens como lidas'
    });

  }
};