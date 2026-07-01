const Profissional = require("../../models/Profissional");
const { updateScore } = require("../scoreService");

/**
 * ============================================================
 * TanaEngine™
 * Activity Engine
 *
 * Responsável por registrar toda atividade do profissional.
 *
 * Fluxo:
 *
 * Evento
 *      ↓
 * Atualiza métricas
 *      ↓
 * Recalcula TanaScore
 *      ↓
 * (Futuro)
 * AchievementEngine
 * RankingEngine
 * MatchEngine
 * ============================================================
 */

const EVENTS = require("./events");
async function findProfessional(identifier) {

  if (!identifier) {
    throw new Error("Profissional não informado.");
  }

  // Primeiro tenta pelo _id da coleção Profissional
  let profissional = await Profissional.findById(identifier);

  if (profissional) {
    return profissional;
  }

  // Depois tenta pelo userId
  profissional = await Profissional.findOne({
    userId: identifier,
  });

  if (profissional) {
    return profissional;
  }

  throw new Error("Profissional não encontrado.");

}
async function register(profissionalId, event) {

  try {

    if (!profissionalId || !event) {
      return null;
    }

  const profissional = await findProfessional(profissionalId);

  if (!profissional) {
    return null;
  }

  if (!profissional.metrics) {
    profissional.metrics = {};
  }

  if (!profissional.metrics.activity) {

    profissional.metrics.activity = {

      ofertasPublicadas: 0,
      ofertasAtivas: 0,
      mensagensRespondidas: 0,
      perfilAtualizado: 0,
      servicosAceitos: 0,
      loginsConsecutivos: 0,
      ultimoLogin: null,

    };

  }

  const activity = profissional.metrics.activity;

  switch (event) {

    case EVENTS.OFFER_CREATED:

      activity.ofertasPublicadas += 1;
      activity.ofertasAtivas += 1;

      break;

    case EVENTS.OFFER_UPDATED:

      // reservado para futuras métricas

      break;

    case EVENTS.CHAT_ANSWERED:

      activity.mensagensRespondidas += 1;

      break;

    case EVENTS.PROFILE_UPDATED:

      activity.perfilAtualizado += 1;

      break;

    case EVENTS.SERVICE_ACCEPTED:

      activity.servicosAceitos += 1;

      break;

    case EVENTS.SERVICE_FINISHED:

      // futuramente podemos dar XP extra
      break;

    case EVENTS.DAILY_LOGIN: {

      const hoje = new Date();

      hoje.setHours(0, 0, 0, 0);

      const ultimo = activity.ultimoLogin
        ? new Date(activity.ultimoLogin)
        : null;

      if (ultimo) {
        ultimo.setHours(0, 0, 0, 0);
      }

      if (!ultimo || ultimo.getTime() !== hoje.getTime()) {

        activity.loginsConsecutivos += 1;
        activity.ultimoLogin = new Date();

      }

      break;
    }

    default:
      break;

  }

  await profissional.save();

  // Atualiza automaticamente o TanaScore
  await updateScore(profissional._id);

 return profissional.metrics.activity;

  } catch (error) {

    console.error(
      "[TanaEngine] register:",
      error.message
    );

    return null;

  }

}

module.exports = {

  EVENTS,

  register,

};