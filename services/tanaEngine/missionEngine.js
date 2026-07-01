/**
 * ============================================================
 * TanaEngine™
 * Mission Engine
 * ------------------------------------------------------------
 * Catálogo oficial de missões do Tanamão+.
 *
 * Este arquivo NÃO calcula progresso.
 * Apenas define todas as missões disponíveis.
 *
 * O progresso será calculado pelo MissionProgressEngine.
 * ============================================================
 */

const EVENTS = require("./events");

const MISSION_TYPES = Object.freeze({
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  PERMANENT: "permanent",
  SPECIAL: "special",
});

const MISSION_CATEGORIES = Object.freeze({
  PROFILE: "profile",
  CHAT: "chat",
  OFFER: "offer",
  SERVICE: "service",
  LOGIN: "login",
  REPUTATION: "reputation",
  ENGAGEMENT: "engagement",
});

const MISSIONS = [

  /* ============================================================
     PERFIL
  ============================================================ */

  {
    id: "complete_profile",

    type: MISSION_TYPES.PERMANENT,

    category: MISSION_CATEGORIES.PROFILE,

    priority: 1,

    event: EVENTS.PROFILE_UPDATED,

    title: "Perfil Completo",

    description:
      "Complete e mantenha seu perfil atualizado.",

    icon: "person-circle",

    color: "#2E7D32",

    badge: "perfil_completo",

    goal: 1,

    reward: {
      xp: 10,
      score: 3,
    },
  },

  /* ============================================================
     OFERTAS
  ============================================================ */

  {
    id: "first_offer",

    type: MISSION_TYPES.PERMANENT,

    category: MISSION_CATEGORIES.OFFER,

    priority: 1,

    event: EVENTS.OFFER_CREATED,

    title: "Primeira Oferta",

    description:
      "Publique sua primeira oferta.",

    icon: "pricetag",

    color: "#FF9800",

    badge: "primeira_oferta",

    goal: 1,

    reward: {
      xp: 5,
      score: 2,
    },
  },

  {
    id: "five_offers",

    type: MISSION_TYPES.PERMANENT,

    category: MISSION_CATEGORIES.OFFER,

    priority: 2,

    event: EVENTS.OFFER_CREATED,

    title: "Empreendedor",

    description:
      "Publique cinco ofertas.",

    icon: "briefcase",

    color: "#FF9800",

    badge: "empreendedor",

    goal: 5,

    reward: {
      xp: 25,
      score: 5,
    },
  },

  /* ============================================================
     CHAT
  ============================================================ */

  {
    id: "first_chat",

    type: MISSION_TYPES.PERMANENT,

    category: MISSION_CATEGORIES.CHAT,

    priority: 1,

    event: EVENTS.CHAT_ANSWERED,

    title: "Primeiro Atendimento",

    description:
      "Responda sua primeira mensagem.",

    icon: "chatbubble",

    color: "#42A5F5",

    badge: "primeiro_chat",

    goal: 1,

    reward: {
      xp: 5,
      score: 2,
    },
  },

  {
    id: "twenty_chats",

    type: MISSION_TYPES.PERMANENT,

    category: MISSION_CATEGORIES.CHAT,

    priority: 2,

    event: EVENTS.CHAT_ANSWERED,

    title: "Comunicador",

    description:
      "Responda 20 mensagens.",

    icon: "chatbubbles",

    color: "#42A5F5",

    badge: "comunicador",

    goal: 20,

    reward: {
      xp: 30,
      score: 6,
    },
  },

  /* ============================================================
     SERVIÇOS
  ============================================================ */

  {
    id: "first_service",

    type: MISSION_TYPES.PERMANENT,

    category: MISSION_CATEGORIES.SERVICE,

    priority: 1,

    event: EVENTS.SERVICE_ACCEPTED,

    title: "Primeiro Serviço",

    description:
      "Aceite seu primeiro serviço.",

    icon: "construct",

    color: "#43A047",

    badge: "primeiro_servico",

    goal: 1,

    reward: {
      xp: 15,
      score: 4,
    },
  },

  /* ============================================================
     LOGIN
  ============================================================ */

  {
    id: "daily_login",

    type: MISSION_TYPES.DAILY,

    category: MISSION_CATEGORIES.LOGIN,

    priority: 3,

    event: EVENTS.DAILY_LOGIN,

    title: "Volte Amanhã",

    description:
      "Entre no aplicativo diariamente.",

    icon: "calendar",

    color: "#7E57C2",

    badge: "login_diario",

    goal: 1,

    reward: {
      xp: 2,
      score: 1,
    },
  },

];

/* ============================================================
   HELPERS
============================================================ */

function getMissions() {
  return MISSIONS;
}

function getMission(id) {
  return MISSIONS.find((m) => m.id === id);
}

function getMissionsByEvent(event) {
  return MISSIONS.filter((m) => m.event === event);
}

function getDailyMissions() {
  return MISSIONS.filter(
    (m) => m.type === MISSION_TYPES.DAILY
  );
}

function getWeeklyMissions() {
  return MISSIONS.filter(
    (m) => m.type === MISSION_TYPES.WEEKLY
  );
}

function getPermanentMissions() {
  return MISSIONS.filter(
    (m) => m.type === MISSION_TYPES.PERMANENT
  );
}

module.exports = {

  MISSION_TYPES,

  MISSION_CATEGORIES,

  getMission,

  getMissions,

  getMissionsByEvent,

  getDailyMissions,

  getWeeklyMissions,

  getPermanentMissions,

};