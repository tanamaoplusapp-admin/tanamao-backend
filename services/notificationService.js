// services/notificationService.js

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/user');
const { enviarPushParaUsuario } = require('./pushService');

/* =========================================================
   HELPERS
========================================================= */

const texto = (valor) => {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
};

const upper = (valor) => texto(valor).toUpperCase();

const stringifyId = (valor) => {
  if (!valor) return '';

  if (typeof valor === 'object') {
    if (valor._id) return String(valor._id);
    if (valor.id) return String(valor.id);
  }

  return String(valor);
};

const sameId = (a, b) => {
  const idA = stringifyId(a);
  const idB = stringifyId(b);

  return !!idA && !!idB && idA === idB;
};

const toObjectIdOrString = (valor) => {
  if (!valor) return null;

  const id = stringifyId(valor);

  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : id;
};

const normalizePushValue = (value) => {
  if (value === null || value === undefined) return '';

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const normalizePushData = (data = {}) => {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      normalizePushValue(value),
    ])
  );
};

const formatarValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;

  const numero = Number(valor);

  if (Number.isNaN(numero)) return null;

  return `R$ ${numero.toFixed(2).replace('.', ',')}`;
};

const hasAnyPushToken = (user = {}) => {
  if (!user) return false;

  if (user.fcmToken) return true;
  if (user.pushToken) return true;
  if (user.expoPushToken) return true;

  if (Array.isArray(user.deviceTokens) && user.deviceTokens.length > 0) {
    return true;
  }

  if (Array.isArray(user.pushTokens) && user.pushTokens.length > 0) {
    return true;
  }

  return false;
};

const statusPermiteChatPush = (status) => {
  const value = texto(status).toLowerCase();

  if (!value) return true;

  return [
    'aceito',
    'em_andamento',
    'andamento',
    'ativo',
  ].includes(value);
};

/* =========================================================
   CONTEÚDO PADRÃO POR TIPO
========================================================= */

function getNotificationContent({ type, title, message, payload = {} }) {
  const finalType = upper(type);

  const tituloManual = texto(title);
  const mensagemManual = texto(message);

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
    payload?.cliente?.name ||
    '';

  const nomeProfissional =
    payload?.profissionalNome ||
    payload?.nomeProfissional ||
    payload?.profissional?.nome ||
    payload?.profissional?.name ||
    payload?.prestadorNome ||
    payload?.nomePrestador ||
    '';

  const nomeRemetente =
    payload?.remetenteNome ||
    payload?.senderName ||
    nomeCliente ||
    nomeProfissional ||
    '';

  const valorFormatado = formatarValor(
    payload?.valorFinal ||
      payload?.valor ||
      payload?.preco ||
      payload?.price
  );

  switch (finalType) {
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
        title: 'Serviço aceito',
        message: nomeProfissional
          ? `${nomeProfissional} aceitou o serviço que você solicitou.`
          : 'O prestador aceitou o serviço que você solicitou.',
      };

    case 'SERVICO_RECUSADO':
      return {
        title: 'Serviço recusado',
        message: nomeProfissional
          ? `${nomeProfissional} recusou sua solicitação.`
          : 'Sua solicitação de serviço foi recusada.',
      };

    case 'SERVICO_CANCELADO':
      return {
        title: 'Serviço cancelado',
        message: 'Um serviço foi cancelado. Toque para ver os detalhes.',
      };

    case 'SERVICO_FINALIZADO':
      return {
        title: 'Serviço finalizado',
        message: 'O serviço foi finalizado. Toque para concluir o pagamento.',
      };

    case 'SERVICO_EM_ANDAMENTO':
      return {
        title: 'Serviço em andamento',
        message: 'O atendimento foi iniciado.',
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

    case 'PAGAMENTO_PENDENTE':
      return {
        title: 'Pagamento pendente',
        message: valorFormatado
          ? `Pagamento de ${valorFormatado} pendente.`
          : 'Existe um pagamento pendente.',
      };

    /* =========================
       CHAT
    ========================= */

    case 'NOVA_MENSAGEM':
    case 'CHAT_MESSAGE':
    case 'MENSAGEM_CHAT':
      return {
        title: 'Nova mensagem',
        message: nomeRemetente
          ? `${nomeRemetente} enviou uma mensagem.`
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
        message: nomeProfissional
          ? `${nomeProfissional} confirmou o agendamento.`
          : 'O horário foi confirmado.',
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

    case 'ORCAMENTO_ENVIADO':
      return {
        title: 'Proposta recebida',
        message: nomeProfissional
          ? `${nomeProfissional} enviou uma proposta para você.`
          : 'Você recebeu uma proposta.',
      };

    case 'ORCAMENTO_ACEITO':
      return {
        title: 'Orçamento aceito',
        message: 'O orçamento foi aceito.',
      };

    case 'ORCAMENTO_RECUSADO':
      return {
        title: 'Orçamento recusado',
        message: 'O orçamento foi recusado.',
      };

    default:
      return {
        title: 'Nova atualização',
        message: 'Você tem uma nova atividade no Tanamão+.',
      };
  }
}

/* =========================================================
   ENVIAR NOTIFICAÇÃO COMPLETA
   Serve para CLIENTE, PRESTADOR, ADMIN etc.
========================================================= */

exports.sendNotification = async ({
  userId,
  type,
  title,
  message,

  relatedId = null,

  chatId = null,
  servicoId = null,
  serviceId = null,
  agendamentoId = null,

  payload = {},
  urgente = false,

  skipPush = false,
}) => {
  try {
    const finalUserId = toObjectIdOrString(userId);
    const finalType = upper(type);

    const finalChatId =
      chatId ||
      payload?.chatId ||
      payload?.chat_id ||
      null;

    const finalServicoId =
      servicoId ||
      serviceId ||
      payload?.servicoId ||
      payload?.serviceId ||
      payload?.servico_id ||
      payload?.service_id ||
      null;

    const finalAgendamentoId =
      agendamentoId ||
      payload?.agendamentoId ||
      payload?.agendamento_id ||
      null;

    const finalRelatedId =
      relatedId ||
      finalServicoId ||
      finalChatId ||
      finalAgendamentoId ||
      null;

    if (!finalUserId || !finalType) {
      console.warn('[notificationService.sendNotification] userId/type ausente', {
        userId,
        type,
      });

      return null;
    }

    const enrichedPayload = {
      ...payload,
      type: finalType,
      chatId: stringifyId(finalChatId),
      servicoId: stringifyId(finalServicoId),
      serviceId: stringifyId(finalServicoId),
      agendamentoId: stringifyId(finalAgendamentoId),
      relatedId: stringifyId(finalRelatedId),
      urgente,
    };

    const content = getNotificationContent({
      type: finalType,
      title,
      message,
      payload: enrichedPayload,
    });
    const duplicateServiceTypes = ['NOVO_SERVICO', 'NOVA_SOLICITACAO'];

    if (duplicateServiceTypes.includes(finalType) && finalServicoId) {
      const existingNotification = await Notification.findOne({
        userId: finalUserId,
        type: { $in: duplicateServiceTypes },
        $or: [
          { servicoId: toObjectIdOrString(finalServicoId) },
          { relatedId: toObjectIdOrString(finalServicoId) },
          { 'payload.servicoId': stringifyId(finalServicoId) },
          { 'payload.serviceId': stringifyId(finalServicoId) },
        ],
        createdAt: {
          $gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      }).sort({ createdAt: -1 });

      if (existingNotification) {
        console.log('[notificationService.sendNotification] duplicada ignorada', {
          userId: stringifyId(finalUserId),
          type: finalType,
          servicoId: stringifyId(finalServicoId),
        });

        return existingNotification;
      }
    }
    const notification = await Notification.create({
      userId: finalUserId,
      type: finalType,
      title: content.title,
      message: content.message,
      relatedId: finalRelatedId || null,
      chatId: finalChatId || null,
      servicoId: finalServicoId || null,
      agendamentoId: finalAgendamentoId || null,
      payload: enrichedPayload,
      urgente,
      read: false,
      createdAt: new Date(),
    });

    const updatedUser = await User.findByIdAndUpdate(
      finalUserId,
      {
        $inc: { unreadNotifications: 1 },
      },
      { new: true }
    )
      .select(
        'unreadNotifications fcmToken pushToken expoPushToken deviceTokens pushTokens pushEnabled'
      )
      .lean();

    if (!updatedUser) {
      console.warn('[notificationService.sendNotification] usuário não encontrado', {
        userId: stringifyId(finalUserId),
      });

      return notification;
    }

    if (skipPush) {
      return notification;
    }

    if (updatedUser.pushEnabled === false) {
      console.log('[notificationService.sendNotification] push desativado pelo usuário', {
        userId: stringifyId(finalUserId),
      });

      return notification;
    }

    if (!hasAnyPushToken(updatedUser)) {
      console.log('[notificationService.sendNotification] usuário sem token push', {
        userId: stringifyId(finalUserId),
      });

      return notification;
    }

    try {
      const pushData = normalizePushData({
        ...enrichedPayload,
        notificationId: notification._id,
        unreadNotifications: updatedUser?.unreadNotifications || 1,
      });

      await enviarPushParaUsuario(finalUserId, {
        title: content.title || 'Tanamão+',
        body: content.message || 'Você tem uma nova notificação',

        type: finalType,
        notificationId: stringifyId(notification._id),

        chatId: stringifyId(finalChatId),
        servicoId: stringifyId(finalServicoId),
        serviceId: stringifyId(finalServicoId),
        agendamentoId: stringifyId(finalAgendamentoId),
        relatedId: stringifyId(finalRelatedId),

        unreadNotifications: updatedUser?.unreadNotifications || 1,

        data: pushData,
      });
    } catch (pushErr) {
      console.error(
        '[notificationService.sendNotification.push]',
        pushErr?.message || pushErr
      );
    }

    return notification;
  } catch (err) {
    console.error(
      '[notificationService.sendNotification]',
      err?.message || err
    );

    return null;
  }
};

/* =========================================================
   SERVIÇO: PRESTADOR RECEBE NOVO SERVIÇO
   Regra Tanamão+:
   - Abre tela do serviço.
   - Mesmo se tiver chatId, NÃO deve abrir chat.
========================================================= */

exports.notifyProfissionalNovoServico = async ({
  profissionalId,
  clienteId = null,
  clienteNome = '',
  servicoId,
  serviceId = null,
  chatId = null,
  categoria = '',
  urgente = false,
  tipoServico = 'normal',
  payload = {},
}) => {
  const finalServicoId = servicoId || serviceId;

  if (!profissionalId || !finalServicoId) {
    console.warn('[notificationService.notifyProfissionalNovoServico] dados ausentes', {
      profissionalId,
      servicoId,
      serviceId,
    });

    return null;
  }

  // Evita notificação duplicada para o mesmo serviço/prestador
  const existente = await Notification.findOne({
    userId: toObjectIdOrString(profissionalId),
    type: { $in: ['NOVO_SERVICO', 'NOVA_SOLICITACAO'] },
    $or: [
      { servicoId: toObjectIdOrString(finalServicoId) },
      { relatedId: toObjectIdOrString(finalServicoId) },
      { 'payload.servicoId': stringifyId(finalServicoId) },
      { 'payload.serviceId': stringifyId(finalServicoId) },
    ],
    createdAt: {
      $gte: new Date(Date.now() - 2 * 60 * 1000),
    },
  }).sort({ createdAt: -1 });

  if (existente) {
    console.log('[notificationService.notifyProfissionalNovoServico] duplicada ignorada', {
      profissionalId: stringifyId(profissionalId),
      servicoId: stringifyId(finalServicoId),
    });

    return existente;
  }

  return exports.sendNotification({
    userId: profissionalId,
    type: 'NOVO_SERVICO',
    title: 'Novo serviço para você',
    message: clienteNome
      ? `${clienteNome} solicitou o seu serviço.`
      : 'Um cliente solicitou o seu serviço.',
    relatedId: finalServicoId,
    servicoId: finalServicoId,
    serviceId: finalServicoId,
    chatId,
    urgente,
    payload: {
      notificationKind: 'servico',
      abrir: 'servico',
      destinatarioTipo: 'profissional',
      profissionalId: stringifyId(profissionalId),
      clienteId: stringifyId(clienteId),
      clienteNome,
      servicoId: stringifyId(finalServicoId),
      serviceId: stringifyId(finalServicoId),
      chatId: stringifyId(chatId),
      categoria,
      urgente,
      tipoServico,
      status: 'pendente',
      ...payload,
    },
  });
};
/* =========================================================
   SERVIÇO: CLIENTE RECEBE QUANDO PRESTADOR ACEITA
   Regra Tanamão+:
   - Abre tela do serviço do cliente.
   - NÃO abre chat ainda só porque existe chatId.
========================================================= */

exports.notifyClienteServicoAceito = async ({
  clienteId,
  profissionalId = null,
  profissionalNome = '',
  servicoId,
  serviceId = null,
  chatId = null,
  tipoServico = 'normal',
  payload = {},
}) => {
  const finalServicoId = servicoId || serviceId;

  if (!clienteId || !finalServicoId) {
    console.warn('[notificationService.notifyClienteServicoAceito] dados ausentes', {
      clienteId,
      servicoId,
      serviceId,
    });

    return null;
  }

  return exports.sendNotification({
    userId: clienteId,
    type: 'SERVICO_ACEITO',
    title: 'Serviço aceito',
    message: profissionalNome
      ? `${profissionalNome} aceitou o serviço que você solicitou.`
      : 'O prestador aceitou o serviço que você solicitou.',
    relatedId: finalServicoId,
    servicoId: finalServicoId,
    serviceId: finalServicoId,
    chatId,
    payload: {
      notificationKind: 'servico',
      abrir: 'servico',
      destinatarioTipo: 'cliente',
      clienteId: stringifyId(clienteId),
      profissionalId: stringifyId(profissionalId),
      profissionalNome: profissionalNome || 'O prestador',
      servicoId: stringifyId(finalServicoId),
      serviceId: stringifyId(finalServicoId),
      chatId: stringifyId(chatId),
      status: 'aceito',
      tipoServico,
      ...payload,
    },
  });
};

/* =========================================================
   SERVIÇO: CLIENTE RECEBE QUANDO SERVIÇO ENTRA EM ANDAMENTO
========================================================= */

exports.notifyClienteServicoEmAndamento = async ({
  clienteId,
  profissionalId = null,
  profissionalNome = '',
  servicoId,
  serviceId = null,
  chatId = null,
  tipoServico = 'normal',
  payload = {},
}) => {
  const finalServicoId = servicoId || serviceId;

  if (!clienteId || !finalServicoId) {
    console.warn('[notificationService.notifyClienteServicoEmAndamento] dados ausentes', {
      clienteId,
      servicoId,
      serviceId,
    });

    return null;
  }

  return exports.sendNotification({
    userId: clienteId,
    type: 'SERVICO_EM_ANDAMENTO',
    title: 'Serviço em andamento',
    message: profissionalNome
      ? `${profissionalNome} iniciou o atendimento.`
      : 'O atendimento foi iniciado.',
    relatedId: finalServicoId,
    servicoId: finalServicoId,
    serviceId: finalServicoId,
    chatId,
    payload: {
      notificationKind: 'servico',
      abrir: 'servico',
      destinatarioTipo: 'cliente',
      clienteId: stringifyId(clienteId),
      profissionalId: stringifyId(profissionalId),
      profissionalNome: profissionalNome || 'O prestador',
      servicoId: stringifyId(finalServicoId),
      serviceId: stringifyId(finalServicoId),
      chatId: stringifyId(chatId),
      status: 'em_andamento',
      tipoServico,
      ...payload,
    },
  });
};

/* =========================================================
   CHAT: USUÁRIO RECEBE NOVA MENSAGEM
   Regra Tanamão+:
   - Só abre chat quando type = NOVA_MENSAGEM / CHAT_MESSAGE.
   - Exige chatId.
   - Não notifica o próprio remetente.
   - Só envia se serviço estiver aceito/em andamento,
     quando status for informado.
========================================================= */

exports.notifyUsuarioNovaMensagem = async ({
  userId,
  destinatarioTipo,
  remetenteId = null,
  remetenteTipo = '',
  remetenteNome = '',
  chatId,
  servicoId = null,
  serviceId = null,
  serviceStatus = '',
  mensagemPreview = '',
  payload = {},
}) => {
  const finalServicoId = servicoId || serviceId;

  if (!userId || !chatId) {
    console.warn('[notificationService.notifyUsuarioNovaMensagem] dados ausentes', {
      userId,
      chatId,
      servicoId,
      serviceId,
    });

    return null;
  }

  if (sameId(userId, remetenteId)) {
    console.log('[notificationService.notifyUsuarioNovaMensagem] não notifica o próprio remetente', {
      userId: stringifyId(userId),
      remetenteId: stringifyId(remetenteId),
    });

    return null;
  }

  if (!statusPermiteChatPush(serviceStatus)) {
    console.log('[notificationService.notifyUsuarioNovaMensagem] serviço ainda não permite push de chat', {
      userId: stringifyId(userId),
      chatId: stringifyId(chatId),
      servicoId: stringifyId(finalServicoId),
      serviceStatus,
    });

    return null;
  }

  const finalDestinatarioTipo =
    destinatarioTipo === 'profissional' ||
    destinatarioTipo === 'prestador'
      ? 'profissional'
      : 'cliente';

  return exports.sendNotification({
    userId,
    type: 'NOVA_MENSAGEM',
    title: 'Nova mensagem',
    message: remetenteNome
      ? `${remetenteNome} enviou uma mensagem.`
      : 'Você recebeu uma nova mensagem.',
    relatedId: chatId,
    chatId,
    servicoId: finalServicoId,
    serviceId: finalServicoId,
    payload: {
      notificationKind: 'chat',
      abrir: 'chat',
      destinatarioTipo: finalDestinatarioTipo,
      remetenteId: stringifyId(remetenteId),
      remetenteTipo,
      remetenteNome,
      chatId: stringifyId(chatId),
      servicoId: stringifyId(finalServicoId),
      serviceId: stringifyId(finalServicoId),
      serviceStatus,
      mensagemPreview: texto(mensagemPreview).slice(0, 120),
      ...payload,
    },
  });
};

/* =========================================================
   CHAT: ATALHO ESPECÍFICO PARA CLIENTE
========================================================= */

exports.notifyClienteNovaMensagem = async ({
  clienteId,
  remetenteId = null,
  remetenteTipo = 'profissional',
  remetenteNome = '',
  chatId,
  servicoId = null,
  serviceId = null,
  serviceStatus = '',
  mensagemPreview = '',
  payload = {},
}) => {
  return exports.notifyUsuarioNovaMensagem({
    userId: clienteId,
    destinatarioTipo: 'cliente',
    remetenteId,
    remetenteTipo,
    remetenteNome,
    chatId,
    servicoId,
    serviceId,
    serviceStatus,
    mensagemPreview,
    payload,
  });
};

/* =========================================================
   CHAT: ATALHO ESPECÍFICO PARA PRESTADOR
========================================================= */

exports.notifyProfissionalNovaMensagem = async ({
  profissionalId,
  remetenteId = null,
  remetenteTipo = 'cliente',
  remetenteNome = '',
  chatId,
  servicoId = null,
  serviceId = null,
  serviceStatus = '',
  mensagemPreview = '',
  payload = {},
}) => {
  return exports.notifyUsuarioNovaMensagem({
    userId: profissionalId,
    destinatarioTipo: 'profissional',
    remetenteId,
    remetenteTipo,
    remetenteNome,
    chatId,
    servicoId,
    serviceId,
    serviceStatus,
    mensagemPreview,
    payload,
  });
};

/* =========================================================
   EXPORT AUXILIAR
========================================================= */

exports.getNotificationContent = getNotificationContent;