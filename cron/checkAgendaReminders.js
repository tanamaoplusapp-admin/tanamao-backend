const mongoose = require('mongoose');
const Agenda = require('../models/Agenda');

const {
  notifyLembreteAgendamento,
} = require('../services/notificationService');

const WINDOW_MINUTES = 2;

let executando = false;

/* =========================================================
   HORA FORMATADA
========================================================= */

const getHoraFormatada = (date) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone:
        process.env.CRON_TZ || 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
};

/* =========================================================
   ENVIAR LEMBRETE PARA OS DESTINATÁRIOS
========================================================= */

const enviarParaDestinatarios = async ({
  agenda,
  tipoLembrete,
}) => {
  const hora = getHoraFormatada(
    agenda.dataHoraInicio
  );

  const clienteNome =
    String(agenda.clienteNome || '').trim();

  const tarefas = [];

  /* =====================================================
     PROFISSIONAL
  ===================================================== */

  if (agenda.profissionalId) {
    const mensagem =
      tipoLembrete === '1h'
        ? clienteNome
          ? `Você tem um agendamento com ${clienteNome} daqui a 1 hora${hora ? `, às ${hora}` : ''}.`
          : `Você tem um agendamento daqui a 1 hora${hora ? `, às ${hora}` : ''}.`
        : clienteNome
          ? `Seu agendamento com ${clienteNome} começa em 30 minutos${hora ? `, às ${hora}` : ''}.`
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

          profissionalId:
            String(agenda.profissionalId),

          clienteId: agenda.clienteId
            ? String(agenda.clienteId)
            : '',

          clienteNome:
            agenda.clienteNome || '',

          servicoNome:
            agenda.servicoNome || '',

          dataHoraInicio:
            agenda.dataHoraInicio,

          horaInicio:
            agenda.horaInicio || '',
        },
      })
    );
  }

  /* =====================================================
     CLIENTE
  ===================================================== */

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

          profissionalId:
            String(agenda.profissionalId),

          clienteId:
            String(agenda.clienteId),

          clienteNome:
            agenda.clienteNome || '',

          servicoNome:
            agenda.servicoNome || '',

          dataHoraInicio:
            agenda.dataHoraInicio,

          horaInicio:
            agenda.horaInicio || '',
        },
      })
    );
  }

  await Promise.allSettled(tarefas);
};

/* =========================================================
   PROCESSAR LEMBRETES DA AGENDA
========================================================= */

const processarLembretesAgenda = async () => {
  if (executando) return;

  executando = true;

  try {
    const agora = new Date();

    /* =====================================================
       🔔 LEMBRETE DE 1 HORA
    ===================================================== */

    const alvo1h = new Date(
      agora.getTime() + 60 * 60 * 1000
    );

    const inicio1h = new Date(
      alvo1h.getTime() -
        WINDOW_MINUTES * 60 * 1000
    );

    const fim1h = new Date(
      alvo1h.getTime() +
        WINDOW_MINUTES * 60 * 1000
    );

    /*
     * IMPORTANTE:
     * mongoose.trusted() permite que os operadores
     * do MongoDB sejam utilizados mesmo com
     * sanitizeFilter habilitado no projeto.
     */

    const agendas1h = await Agenda.find(
      mongoose.trusted({
        dataHoraInicio: {
          $gte: inicio1h,
          $lte: fim1h,
        },

        status: {
          $in: [
            'pendente',
            'confirmado',
          ],
        },

        $or: [
          {
            lembrete1hEnviado: false,
          },
          {
            lembrete1hEnviado: {
              $exists: false,
            },
          },
        ],
      })
    );

    for (const agenda of agendas1h) {
      try {
        /*
         * 🔒 TRAVA ATÔMICA
         *
         * Só um processo pode marcar o lembrete
         * como enviado.
         */

        const atualizado =
          await Agenda.findOneAndUpdate(
            mongoose.trusted({
              _id: agenda._id,

              $or: [
                {
                  lembrete1hEnviado: false,
                },
                {
                  lembrete1hEnviado: {
                    $exists: false,
                  },
                },
              ],
            }),
            {
              $set: {
                lembrete1hEnviado: true,
              },
            },
            {
              new: true,
            }
          );

        if (!atualizado) {
          continue;
        }

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
          err?.message || err
        );
      }
    }

    /* =====================================================
       🔔 LEMBRETE DE 30 MINUTOS
    ===================================================== */

    const alvo30min = new Date(
      agora.getTime() + 30 * 60 * 1000
    );

    const inicio30min = new Date(
      alvo30min.getTime() -
        WINDOW_MINUTES * 60 * 1000
    );

    const fim30min = new Date(
      alvo30min.getTime() +
        WINDOW_MINUTES * 60 * 1000
    );

    const agendas30min = await Agenda.find(
      mongoose.trusted({
        dataHoraInicio: {
          $gte: inicio30min,
          $lte: fim30min,
        },

        status: {
          $in: [
            'pendente',
            'confirmado',
          ],
        },

        $or: [
          {
            lembrete30minEnviado: false,
          },
          {
            lembrete30minEnviado: {
              $exists: false,
            },
          },
        ],
      })
    );

    for (const agenda of agendas30min) {
      try {
        /*
         * 🔒 TRAVA ATÔMICA
         */

        const atualizado =
          await Agenda.findOneAndUpdate(
            mongoose.trusted({
              _id: agenda._id,

              $or: [
                {
                  lembrete30minEnviado: false,
                },
                {
                  lembrete30minEnviado: {
                    $exists: false,
                  },
                },
              ],
            }),
            {
              $set: {
                lembrete30minEnviado: true,
              },
            },
            {
              new: true,
            }
          );

        if (!atualizado) {
          continue;
        }

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
          err?.message || err
        );
      }
    }
  } catch (err) {
    console.error(
      '❌ Erro geral ao processar lembretes da agenda:',
      err?.message || err
    );
  } finally {
    executando = false;
  }
};

/* =========================================================
   INICIAR CRON
========================================================= */

const startAgendaReminderCron = () => {
  const cron = require('node-cron');

  cron.schedule(
    '* * * * *',
    processarLembretesAgenda,
    {
      timezone:
        process.env.CRON_TZ ||
        'America/Sao_Paulo',
    }
  );

  console.log(
    '📅 Cron de lembretes da agenda iniciado'
  );
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  startAgendaReminderCron,
  processarLembretesAgenda,
};