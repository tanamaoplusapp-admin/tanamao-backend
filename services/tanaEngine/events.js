/**
 * ============================================================
 * TanaEngine™
 * Events
 * ------------------------------------------------------------
 * Fonte única de eventos utilizados por todos os Engines.
 *
 * activityEngine
 * missionEngine
 * achievementEngine
 * rankingEngine
 * matchEngine
 *
 * Nunca utilize strings diretamente.
 * Sempre importe este arquivo.
 * ============================================================
 */

const EVENTS = Object.freeze({

  /* ============================================================
     PERFIL
  ============================================================ */

  PROFILE_UPDATED: "profile_updated",

  PHOTO_UPDATED: "photo_updated",

  BIO_UPDATED: "bio_updated",

  SERVICE_ADDED: "service_added",

  PROFESSION_ADDED: "profession_added",

  /* ============================================================
     OFERTAS
  ============================================================ */

  OFFER_CREATED: "offer_created",

  OFFER_UPDATED: "offer_updated",

  OFFER_REMOVED: "offer_removed",

  /* ============================================================
     CHAT
  ============================================================ */

  CHAT_ANSWERED: "chat_answered",

  CHAT_STARTED: "chat_started",

  /* ============================================================
     SERVIÇOS
  ============================================================ */

  SERVICE_ACCEPTED: "service_accepted",

  SERVICE_FINISHED: "service_finished",

  SERVICE_CANCELLED: "service_cancelled",

  /* ============================================================
     LOGIN
  ============================================================ */

  DAILY_LOGIN: "daily_login",

  /* ============================================================
     AVALIAÇÕES
  ============================================================ */

  REVIEW_RECEIVED: "review_received",

  FIVE_STAR_REVIEW: "five_star_review",

  /* ============================================================
     TANAMATCH
  ============================================================ */

  MATCH_ACCEPTED: "match_accepted",

  MATCH_COMPLETED: "match_completed",

});

module.exports = EVENTS;