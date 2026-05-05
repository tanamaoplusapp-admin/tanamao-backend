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

/**
 * Campos públicos do usuário usados no chat.
 * Mantém compatibilidade com Cliente, Profissional e telas antigas/novas.
 */
const USER_CHAT_FIELDS =
  'name nome telefone celular whatsapp phone online fotoPerfil foto avatar imagemPerfil profileImage profilePhoto photoURL photoUrl';

/* =========================================================
   CRIAR CHAT
========================================================= */

exports.criarChat = async (req, res) => {
  try {
    const remetenteId = getUserId(req);
    const { destinatarioId } = req.body || {};

    if (!remetenteId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!isObjectId(destinatarioId)) {
      return res.status(400).json({ error: 'destinatarioId inválido.' });
    }

    if (String(remetenteId) === String(destinatarioId)) {
      return res.status(400).json({
        error: 'Não é possível criar chat consigo mesmo.',
      });
    }

    /* ===============================
       1 CLIENTE + 1 PRESTADOR = 1 CHAT
    =============================== */

    let chat = await Chat.findOne({
      participantes: {
        $all: [remetenteId, destinatarioId],
      },
    }).populate('participantes', USER_CHAT_FIELDS);

    if (chat) {
      return res.json(chat);
    }

    chat = await Chat.create({
      participantes: [remetenteId, destinatarioId],
      ultimoTexto: '',
      atualizadoEm: new Date(),
    });

    const chatCriado = await Chat.findById(chat._id)
      .populate('participantes', USER_CHAT_FIELDS)
      .lean();

    return res.status(201).json(chatCriado);
  } catch (error) {
    console.error('criarChat erro:', error);

    return res.status(500).json({
      error: 'Erro ao criar chat',
    });
  }
};

/* =========================================================
   LISTAR CHATS DO USUÁRIO
========================================================= */

exports.buscarChatsDoUsuario = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const chats = await Chat.find({
      participantes: userId,
    })
      .populate('participantes', USER_CHAT_FIELDS)
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
          .sort({ enviadoEm: -1, createdAt: -1 })
          .populate('remetente', USER_CHAT_FIELDS)
          .select('texto remetente enviadoEm createdAt imagemUrl')
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
      error: 'Erro ao buscar chats',
    });
  }
};

/* =========================================================
   ENVIAR MENSAGEM
========================================================= */

exports.enviarMensagem = async (req, res) => {
  try {
    const remetenteId = getUserId(req);

    if (!remetenteId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { chatId } = req.params;
    const { texto, imagemUrl } = req.body || {};

    if (!isObjectId(chatId)) {
      return res.status(400).json({ error: 'chatId inválido.' });
    }

    const textoLimpo = typeof texto === 'string' ? texto.trim() : '';

    if (!textoLimpo && !imagemUrl) {
      return res.status(400).json({ error: 'Mensagem vazia.' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat não encontrado' });
    }

    const participa = chat.participantes.some(
      (p) => String(p) === String(remetenteId)
    );

    if (!participa) {
      return res.status(403).json({
        error: 'Você não participa deste chat.',
      });
    }

    const mensagemCriada = await Mensagem.create({
      chatId,
      remetente: remetenteId,
      texto: textoLimpo,
      imagemUrl: imagemUrl || null,
      enviadoEm: new Date(),
      lidoPor: [remetenteId],
    });

    await Chat.findByIdAndUpdate(chatId, {
      ultimoTexto: textoLimpo || '[Imagem]',
      atualizadoEm: new Date(),
      ultimoRemetente: remetenteId,
      $currentDate: { updatedAt: true },
    });

    const novaMensagem = await Mensagem.findById(mensagemCriada._id)
      .populate('remetente', USER_CHAT_FIELDS)
      .lean();

    const io = req.app.get('io');

   if (io && novaMensagem) {
  io.to(String(chatId)).emit('nova_mensagem', novaMensagem);

  chat.participantes.forEach((userId) => {
    if (String(userId) !== String(remetenteId)) {
      io.to(String(userId)).emit('nova_mensagem', novaMensagem);
    }
  });
}

/* =========================================================
   PUSH DO CHAT
   Quando um participante envia mensagem, o outro recebe push.
========================================================= */

try {
  const destinatarioId = chat.participantes.find(
    (userId) => String(userId) !== String(remetenteId)
  );

  if (destinatarioId) {
    const destinatario = await User.findById(destinatarioId)
      .select('tipo role perfil userType tipoUsuario isProfissional profissional')
      .lean();

    const rawTipo =
      destinatario?.tipo ||
      destinatario?.role ||
      destinatario?.perfil ||
      destinatario?.userType ||
      destinatario?.tipoUsuario ||
      '';

    const tipoNormalizado = String(rawTipo).toLowerCase();

    const destinatarioTipo =
      tipoNormalizado.includes('profissional') ||
      tipoNormalizado.includes('prestador') ||
      destinatario?.isProfissional === true ||
      !!destinatario?.profissional
        ? 'profissional'
        : 'cliente';

    const nomeRemetente =
      novaMensagem?.remetente?.nome ||
      novaMensagem?.remetente?.name ||
      'Alguém';

    const mensagemPreview =
      textoLimpo ||
      (imagemUrl ? 'Enviou uma imagem.' : 'Você recebeu uma nova mensagem.');

    const finalServicoId = chat.serviceId || null;

    await sendNotification({
      userId: destinatarioId,
      type: 'NOVA_MENSAGEM',
      title: 'Nova mensagem',
      message: `${nomeRemetente} enviou uma mensagem.`,
      relatedId: chatId,
      chatId,
      servicoId: finalServicoId,
      serviceId: finalServicoId,
      payload: {
        notificationKind: 'chat',
        abrir: 'chat',

        destinatarioTipo,

        chatId: String(chatId),

        servicoId: finalServicoId ? String(finalServicoId) : '',
        serviceId: finalServicoId ? String(finalServicoId) : '',

        remetenteId: String(remetenteId),
        remetenteNome: nomeRemetente,

        mensagemId: String(novaMensagem?._id || mensagemCriada?._id),
        mensagemPreview: String(mensagemPreview).slice(0, 120),
      },
    });
  }
} catch (pushError) {
  console.error(
    '[chatController.enviarMensagem.push]',
    pushError?.message || pushError
  );
}

return res.status(201).json(novaMensagem || mensagemCriada);
  } catch (error) {
    console.error('enviarMensagem erro:', error);

    return res.status(500).json({
      error: 'Erro ao enviar mensagem',
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

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!isObjectId(chatId)) {
      return res.status(400).json({ error: 'chatId inválido.' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat não encontrado' });
    }

    const participa = chat.participantes.some(
      (p) => String(p) === String(userId)
    );

    if (!participa) {
      return res.status(403).json({
        error: 'Você não participa deste chat.',
      });
    }

    const mensagens = await Mensagem.find({ chatId })
      .populate('remetente', USER_CHAT_FIELDS)
      .sort({ enviadoEm: 1, createdAt: 1 })
      .lean();

    return res.json(mensagens);
  } catch (error) {
    console.error('listarMensagens erro:', error);

    return res.status(500).json({
      error: 'Erro ao buscar mensagens',
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

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!isObjectId(chatId)) {
      return res.status(400).json({ error: 'chatId inválido.' });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat não encontrado' });
    }

    const participa = chat.participantes.some(
      (p) => String(p) === String(userId)
    );

    if (!participa) {
      return res.status(403).json({
        error: 'Você não participa deste chat.',
      });
    }

    const mensagens = await Mensagem.find({
      chatId: chatId,
    });

    for (const msg of mensagens) {
      if (String(msg.remetente) === String(userId)) {
        continue;
      }

      const jaLeu = Array.isArray(msg.lidoPor)
        ? msg.lidoPor.some(
            (id) => String(id) === String(userId)
          )
        : false;

      if (!jaLeu) {
        msg.lidoPor = Array.isArray(msg.lidoPor) ? msg.lidoPor : [];
        msg.lidoPor.push(userId);
        await msg.save();
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('marcarComoLido erro:', error);

    return res.status(500).json({
      error: 'Erro ao marcar mensagens como lidas',
    });
  }
};

/* =========================================================
   BUSCAR CHAT POR ID
========================================================= */

exports.buscarChatPorId = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const userId =
      req.userId ||
      req.user?.id ||
      req.user?._id;

    const { chatId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!isObjectId(chatId)) {
      return res.status(400).json({ error: 'chatId inválido.' });
    }

    const chat = await Chat.findById(chatId)
      .populate('participantes', USER_CHAT_FIELDS)
      .lean();

    if (!chat) {
      return res.status(404).json({ error: 'Chat não encontrado' });
    }

    const participa = chat.participantes.some(
      (p) => String(p._id) === String(userId)
    );

    console.log('CHAT POR ID:', {
      chatId,
      userId: String(userId),
      participantes: chat.participantes.map((p) => ({
        id: String(p._id),
        name: p.name,
        nome: p.nome,
        telefone: p.telefone || p.celular || p.whatsapp || p.phone,
        fotoPerfil:
          p.fotoPerfil ||
          p.foto ||
          p.avatar ||
          p.imagemPerfil ||
          p.profileImage ||
          p.profilePhoto ||
          p.photoURL ||
          p.photoUrl ||
          null,
      })),
    });

    if (!participa) {
      return res.status(403).json({
        error: 'Você não participa deste chat.',
      });
    }

    return res.json(chat);
  } catch (error) {
    console.error('buscarChatPorId erro:', error);

    return res.status(500).json({
      error: 'Erro ao buscar chat',
    });
  }
};