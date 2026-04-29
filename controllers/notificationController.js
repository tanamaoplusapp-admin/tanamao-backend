// controllers/notificationController.js

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/user');
const { enviarPushParaUsuario } = require('../services/pushService');

const resolveUserId = (req) => {
  const maybe =
    req.user?.userId ||
    req.userId ||
    req.user?.id ||
    req.user?.sub ||
    null;

  if (!maybe) return null;

  return mongoose.Types.ObjectId.isValid(maybe)
    ? new mongoose.Types.ObjectId(maybe)
    : String(maybe);
};

const texto = (valor) => {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
};

const getNotificationContent = ({ type, title, message, payload = {} }) => {
  const tituloManual = texto(title);
  const mensagemManual = texto(message);

  // 🔒 PRIORIDADE: se veio manual, respeita
  if (tituloManual || mensagemManual) {
    return {
      title: tituloManual || 'Tanamão+',
      message: mensagemManual || tituloManual,
    };
  }

  const nomeCliente =
    payload?.clienteNome ||
    payload?.nomeCliente ||
    payload?.cliente?.nome ||
    '';

  const nomeProfissional =
    payload?.profissionalNome ||
    payload?.nomeProfissional ||
    payload?.profissional?.nome ||
    '';

  const valor =
    payload?.valorFinal ||
    payload?.valor ||
    payload?.preco ||
    null;

  const valorFormatado =
    valor !== null && valor !== undefined
      ? `R$ ${Number(valor).toFixed(2).replace('.', ',')}`
      : null;

  /* =========================================================
     UX PREMIUM (FOCO: CLAREZA + CONVERSÃO)
  ========================================================= */

  switch (type) {
    /* =========================
       SERVIÇOS
    ========================= */

    case 'NOVA_SOLICITACAO':
    case 'NOVO_SERVICO':
      return {
        title: 'Novo serviço para você',
        message: nomeCliente
          ? `${nomeCliente} solicitou atendimento.`
          : 'Um cliente acabou de solicitar um serviço.',
      };

    case 'SERVICO_ACEITO':
      return {
        title: 'Serviço confirmado',
        message: nomeProfissional
          ? `${nomeProfissional} aceitou o atendimento.`
          : 'O serviço foi aceito.',
      };

    case 'SERVICO_CANCELADO':
      return {
        title: 'Serviço cancelado',
        message: 'Um serviço foi cancelado. Toque para ver os detalhes.',
      };

    /* =========================
       PAGAMENTO
    ========================= */

    case 'SERVICO_PAGO':
    case 'PAGAMENTO_RECEBIDO':
      return {
        title: 'Pagamento confirmado',
        message: valorFormatado
          ? `Pagamento de ${valorFormatado} confirmado.`
          : 'Pagamento confirmado no Tanamão+.',
      };

    /* =========================
       CHAT
    ========================= */

    case 'NOVA_MENSAGEM':
    case 'CHAT_MESSAGE':
      return {
        title: 'Nova mensagem',
        message: nomeCliente
          ? `${nomeCliente} enviou uma mensagem.`
          : nomeProfissional
            ? `${nomeProfissional} enviou uma mensagem.`
            : 'Você recebeu uma nova mensagem.',
      };

    /* =========================
       AGENDAMENTO
    ========================= */

    case 'AGENDAMENTO_CRIADO':
      return {
        title: 'Novo agendamento',
        message: nomeCliente
          ? `${nomeCliente} solicitou um horário.`
          : 'Um cliente solicitou um agendamento.',
      };

    case 'AGENDAMENTO_CONFIRMADO':
      return {
        title: 'Agendamento confirmado',
        message: 'O horário foi confirmado.',
      };

    case 'AGENDAMENTO_CANCELADO':
      return {
        title: 'Agendamento cancelado',
        message: 'Um agendamento foi cancelado.',
      };

    /* =========================
       ORÇAMENTO
    ========================= */

    case 'ORCAMENTO_RECEBIDO':
      return {
        title: 'Novo orçamento',
        message: nomeCliente
          ? `${nomeCliente} solicitou uma proposta.`
          : 'Você recebeu uma solicitação de orçamento.',
      };

    case 'ORCAMENTO_ACEITO':
      return {
        title: 'Orçamento aceito',
        message: 'O cliente aceitou sua proposta.',
      };

    case 'ORCAMENTO_RECUSADO':
      return {
        title: 'Orçamento recusado',
        message: 'O cliente recusou a proposta.',
      };

    /* =========================
       FALLBACK
    ========================= */

    default:
      return {
        title: 'Nova atualização',
        message: 'Você tem uma nova atividade no Tanamão+.',
      };
  }
};

/* =========================================================
   LISTAR MINHAS NOTIFICAÇÕES
========================================================= */

exports.listMine = async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado',
      });
    }

    const items = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const normalizedItems = items.map((item) => {
      const content = getNotificationContent({
        type: item.type,
        title: item.title,
        message: item.message,
        payload: item.payload || {},
      });

      return {
        ...item,
        title: texto(item.title) || content.title,
        message: texto(item.message) || content.message,
      };
    });

    return res.json({
      ok: true,
      items: normalizedItems,
    });
  } catch (err) {
    console.error('notification.listMine error', err);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar notificações',
      details: err.message,
    });
  }
};

/* =========================================================
   MARCAR COMO LIDA
========================================================= */

exports.markRead = async (req, res) => {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado',
      });
    }

    const notification = await Notification.findOne({
      _id: req.params.id,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        ok: false,
        message: 'Notificação não encontrada.',
      });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();

      await User.updateOne(
        {
          _id: userId,
          unreadNotifications: { $gt: 0 },
        },
        {
          $inc: { unreadNotifications: -1 },
        }
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('notification.markRead error', err);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao marcar leitura',
      details: err.message,
    });
  }
};

/* =========================================================
   CRIAR NOTIFICAÇÃO — USO INTERNO DO SISTEMA
========================================================= */

exports.createNotification = async ({
  userId,
  type,
  title,
  message,
  chatId = null,
  servicoId = null,
  serviceId = null,
  agendamentoId = null,
  urgente = false,
  payload = {},
  relatedId = null,
}) => {
  try {
    if (!userId || !type) {
      console.warn('[notification.createNotification] userId/type ausente', {
        userId,
        type,
      });
      return null;
    }

    const finalServicoId = servicoId || serviceId || null;

    const content = getNotificationContent({
      type,
      title,
      message,
      payload,
    });

    const notification = await Notification.create({
      userId,
      type,
      title: content.title,
      message: content.message,
      chatId,
      servicoId: finalServicoId,
      agendamentoId,
      urgente,
      payload,
      relatedId,
      read: false,
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { unreadNotifications: 1 },
      },
      { new: true }
    );

    try {
      await enviarPushParaUsuario(userId, {
        title: content.title || 'Tanamão+',
        body: content.message || 'Você tem uma nova notificação',
        type,
        notificationId: String(notification._id),
        chatId: chatId ? String(chatId) : null,
        servicoId: finalServicoId ? String(finalServicoId) : null,
        serviceId: finalServicoId ? String(finalServicoId) : null,
        agendamentoId: agendamentoId ? String(agendamentoId) : null,
        unreadNotifications: updatedUser?.unreadNotifications || 1,
        data: {
          type,
          notificationId: String(notification._id),
          chatId: chatId ? String(chatId) : null,
          servicoId: finalServicoId ? String(finalServicoId) : null,
          serviceId: finalServicoId ? String(finalServicoId) : null,
          agendamentoId: agendamentoId ? String(agendamentoId) : null,
          relatedId: relatedId ? String(relatedId) : null,
          urgente,
          ...payload,
        },
      });
    } catch (pushErr) {
      console.error('[notification.createNotification.push]', pushErr);
    }

    return notification;
  } catch (err) {
    console.error('[notification.createNotification]', err);
    return null;
  }
};