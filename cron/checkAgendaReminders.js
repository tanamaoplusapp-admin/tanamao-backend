const Agenda = require('../models/Agenda');
const {
  notifyLembreteAgendamento,
} = require('../services/notificationService');

const WINDOW_MINUTES = 2;

let executando = false;

const getHoraFormatada = (date) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: process.env.CRON_TZ || 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
};

const enviarParaDestinatarios = async ({
  agenda,
  tipoLembrete,
}) => {
  const hora = getHoraFormatada(agenda.dataHoraInicio);

  const clientesNome =
    String(agenda.clienteNome || '').trim();

  const tarefas = [];

  // 🔔 PROFISSIONAL
  if (agenda.profissionalId) {
    const mensagem =
      tipoLembrete === '1h'
        ? clientesNome
          ? `Você tem um agendamento com ${clientesNome} daqui a 1 hora${hora ? `, às ${hora}` : ''}.`
          : `Você tem um agendamento daqui a 1 hora${hora ? `, às ${hora}` : ''}.`
        : clientesNome
          ? `Seu agendamento com ${clientesNome} começa em 30 minutos${hora ? `, às ${hora}` : ''}.`
          : `Seu agendamento começa em 30 minutos${hora ? `, às ${hora}` : ''}.`;

    tarefas.push(
      notifyLembreteAgendamento({
        userId: agenda.profissionalId,
        agendamentoId: agenda._id,
        tipoLembrete,
        titulo:
          tipoLembrete === '1h'
            ? 'Lembrete de agendamento'
            : 'Agendamento em 30 minutos',
        mensagem,
        payload: {
          destinatarioTipo: 'profissional',
          profissionalId: String(agenda.profissionalId),
          clienteId: agenda.clienteId
            ? String(agenda.clienteId)
            : '',
          clienteNome: agenda.clienteNome || '',
          servicoNome: agenda.servicoNome || '',
          dataHoraInicio: agenda.dataHoraInicio,
          horaInicio: agenda.horaInicio || '',
        },
      })
    );
  }

  // 🔔 CLIENTE
  if (agenda.clienteId) {
    const mensagem =
      tipoLembrete === '1h'
        ? `Você tem um agendamento daqui a 1 hora${hora ? `, às ${hora}` : ''}.`
        : `Seu agendamento começa em 30 minutos${hora ? `, às ${hora}` : ''}.`;

    tarefas.push(
      notifyLembreteAgendamento({
        userId: agenda.clienteId,
        agendamentoId: agenda._id,
        tipoLembrete,
        titulo:
          tipoLembrete === '1h'
            ? 'Lembrete de agendamento'
            : 'Agendamento em 30 minutos',
        mensagem,
        payload: {
          destinatarioTipo: 'cliente',
          profissionalId: String(agenda.profissionalId),
          clienteId: String(agenda.clienteId),
          clienteNome: agenda.clienteNome || '',
          servicoNome: agenda.servicoNome || '',
          dataHoraInicio: agenda.dataHoraInicio,
          horaInicio: agenda.horaInicio || '',
        },
      })
    );
  }

  await Promise.allSettled(tarefas);
};

const processarLembretesAgenda = async () => {
  if (executando) return;

  executando = true;

  try {
    const agora = new Date();

    const inicioJanela = new Date(
      agora.getTime() - WINDOW_MINUTES * 60 * 1000
    );

    const fimJanela = new Date(
      agora.getTime() + WINDOW_MINUTES * 60 * 1000
    );

    // =====================================================
    // 🔔 LEMBRETE DE 1 HORA
    // =====================================================

    const alvo1h = new Date(
      agora.getTime() + 60 * 60 * 1000
    );

    const inicio1h = new Date(
      alvo1h.getTime() - WINDOW_MINUTES * 60 * 1000
    );

    const fim1h = new Date(
      alvo1h.getTime() + WINDOW_MINUTES * 60 * 1000
    );

    const agendas1h = await Agenda.find({
      dataHoraInicio: {
        $gte: inicio1h,
        $lte: fim1h,
      },

      status: {
        $nin: ['cancelado', 'finalizado'],
      },

     $or: [
  { lembrete1hEnviado: false },
  { lembrete1hEnviado: { $exists: false } },
],
    });

    for (const agenda of agendas1h) {
      try {
        // Trava atômica para impedir duplicação
        const atualizado = await Agenda.findOneAndUpdate(
          {
            _id: agenda._id,
           $or: [
  { lembrete1hEnviado: false },
  { lembrete1hEnviado: { $exists: false } },
],
          },
          {
            $set: {
              lembrete1hEnviado: true,
            },
          },
          {
            new: true,
          }
        );

        if (!atualizado) continue;

        await enviarParaDestinatarios({
          agenda: atualizado,
          tipoLembrete: '1h',
        });

        console.log(
          `🔔 Lembrete 1h enviado: ${atualizado._id}`
        );
      } catch (err) {
        console.error(
          '❌ Erro no lembrete de 1h:',
          agenda._id,
          err.message
        );
      }
    }

    // =====================================================
    // 🔔 LEMBRETE DE 30 MINUTOS
    // =====================================================

    const alvo30min = new Date(
      agora.getTime() + 30 * 60 * 1000
    );

    const inicio30min = new Date(
      alvo30min.getTime() - WINDOW_MINUTES * 60 * 1000
    );

    const fim30min = new Date(
      alvo30min.getTime() + WINDOW_MINUTES * 60 * 1000
    );

    const agendas30min = await Agenda.find({
      dataHoraInicio: {
        $gte: inicio30min,
        $lte: fim30min,
      },

      status: {
        $nin: ['cancelado', 'finalizado'],
      },

     $or: [
  { lembrete30minEnviado: false },
  { lembrete30minEnviado: { $exists: false } },
],
    });

    for (const agenda of agendas30min) {
      try {
        // Trava atômica para impedir duplicação
        const atualizado = await Agenda.findOneAndUpdate(
          {
            _id: agenda._id,
            $or: [
  { lembrete30minEnviado: false },
  { lembrete30minEnviado: { $exists: false } },
],
          },
          {
            $set: {
              lembrete30minEnviado: true,
            },
          },
          {
            new: true,
          }
        );

        if (!atualizado) continue;

        await enviarParaDestinatarios({
          agenda: atualizado,
          tipoLembrete: '30min',
        });

        console.log(
          `🔔 Lembrete 30min enviado: ${atualizado._id}`
        );
      } catch (err) {
        console.error(
          '❌ Erro no lembrete de 30 minutos:',
          agenda._id,
          err.message
        );
      }
    }

  } catch (err) {
    console.error(
      '❌ Erro geral ao processar lembretes da agenda:',
      err.message
    );
  } finally {
    executando = false;
  }
};

const startAgendaReminderCron = () => {
  const cron = require('node-cron');

  cron.schedule(
    '* * * * *',
    processarLembretesAgenda,
    {
      timezone:
        process.env.CRON_TZ || 'America/Sao_Paulo',
    }
  );

  console.log(
    '📅 Cron de lembretes da agenda iniciado'
  );
};

module.exports = {
  startAgendaReminderCron,
  processarLembretesAgenda,
};