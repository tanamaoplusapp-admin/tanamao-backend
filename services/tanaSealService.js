/**
 * ============================================================
 * TanaSealService™
 * ------------------------------------------------------------
 * Selos Oficiais do Tanamão+
 *
 * Os TanaSelos representam a reputação e o desempenho
 * conquistados dentro da plataforma.
 *
 * Eles influenciam:
 *
 * • Perfil
 * • Busca
 * • Ranking
 * • SearchScore
 * • TanaMatch
 *
 * ============================================================
 */

const SEALS = Object.freeze({

  BRONZE: "bronze",

  SILVER: "silver",

  GOLD: "gold",

  DIAMOND: "diamond",

  ELITE: "elite",

  COMPLETE_PROFILE: "complete_profile",

  FAST_RESPONSE: "fast_response",

  SPECIALIST: "specialist",

  TOP_RATED: "top_rated",

  ACTIVE_PRO: "active_pro",

  TOP10_CITY: "top10_city",

  TOP3_CITY: "top3_city",

  CITY_LEADER: "city_leader",

  TANA_HIGHLIGHT: "tana_highlight",

});

/* ============================================================
   CATÁLOGO
============================================================ */

const CATALOG = {

  [SEALS.BRONZE]: {

    title: "Bronze",

    icon: "medal-outline",

    color: "#CD7F32",

    description:
      "Primeiro nível conquistado no TanaScore.",

    benefit:
      "Aumenta sua credibilidade.",

  },

  [SEALS.SILVER]: {

    title: "Prata",

    icon: "medal",

    color: "#B0BEC5",

    description:
      "Profissional em evolução.",

    benefit:
      "Maior destaque no perfil.",

  },

  [SEALS.GOLD]: {

    title: "Ouro",

    icon: "ribbon",

    color: "#F9A825",

    description:
      "Excelente reputação.",

    benefit:
      "+3% SearchScore.",

  },

  [SEALS.DIAMOND]: {

    title: "Diamante",

    icon: "diamond",

    color: "#26C6DA",

    description:
      "Entre os melhores profissionais.",

    benefit:
      "+6% SearchScore.",

  },

  [SEALS.ELITE]: {

    title: "Elite",

    icon: "trophy",

    color: "#7E57C2",

    description:
      "Excelência comprovada.",

    benefit:
      "+10% SearchScore.",

  },

  [SEALS.COMPLETE_PROFILE]: {

    title: "Perfil Completo",

    icon: "person-circle",

    color: "#43A047",

    description:
      "Perfil preenchido completamente.",

    benefit:
      "Maior confiança para clientes.",

  },

  [SEALS.FAST_RESPONSE]: {

    title: "Resposta Rápida",

    icon: "flash",

    color: "#FB8C00",

    description:
      "Responde clientes rapidamente.",

    benefit:
      "+5% SearchScore.",

  },

  [SEALS.SPECIALIST]: {

    title: "Especialista",

    icon: "construct",

    color: "#00897B",

    description:
      "Grande experiência comprovada.",

    benefit:
      "Maior destaque em buscas.",

  },

  [SEALS.TOP_RATED]: {

    title: "Muito Bem Avaliado",

    icon: "star",

    color: "#FFD54F",

    description:
      "Avaliações excelentes.",

    benefit:
      "Mais confiança.",

  },

  [SEALS.ACTIVE_PRO]: {

    title: "Profissional Ativo",

    icon: "flame",

    color: "#F4511E",

    description:
      "Alta atividade dentro do aplicativo.",

    benefit:
      "Mais visibilidade.",

  },

  [SEALS.TOP10_CITY]: {

    title: "Top 10 da Cidade",

    icon: "podium",

    color: "#42A5F5",

    description:
      "Entre os dez melhores da cidade.",

    benefit:
      "+5% SearchScore.",

  },

  [SEALS.TOP3_CITY]: {

    title: "Top 3 da Cidade",

    icon: "trophy",

    color: "#1976D2",

    description:
      "Entre os três melhores profissionais da cidade.",

    benefit:
      "+10% SearchScore.",

  },

  [SEALS.CITY_LEADER]: {

    title: "Líder da Cidade",

    icon: "ribbon",

    color: "#D81B60",

    description:
      "Primeiro colocado no ranking municipal.",

    benefit:
      "Maior prioridade nas buscas.",

  },

  [SEALS.TANA_HIGHLIGHT]: {

    title: "Destaque Tanamão",

    icon: "rocket",

    color: "#FF6F00",

    description:
      "Profissional de alto desempenho.",

    benefit:
      "Máxima visibilidade.",

  },

};

/* ============================================================
   GERAÇÃO DOS SELOS
============================================================ */

function generateSeals(
  profissional,
  ranking = {}
) {

  const seals = [];

  const score = profissional.tanaScore || 0;

  const modules =
    profissional.tanaModules || {};

  /* SCORE */

  if (score >= 40)
    seals.push(SEALS.BRONZE);

  if (score >= 60)
    seals.push(SEALS.SILVER);

  if (score >= 75)
    seals.push(SEALS.GOLD);

  if (score >= 90)
    seals.push(SEALS.DIAMOND);

  if (score >= 95)
    seals.push(SEALS.ELITE);

  /* PERFIL */

  if ((modules.profile || 0) === 100)
    seals.push(SEALS.COMPLETE_PROFILE);

  /* RESPOSTA */

  if ((modules.response || 0) >= 90)
    seals.push(SEALS.FAST_RESPONSE);

  /* EXPERIÊNCIA */

  if ((modules.experience || 0) >= 90)
    seals.push(SEALS.SPECIALIST);

  /* AVALIAÇÕES */

  if ((modules.reviews || 0) >= 95)
    seals.push(SEALS.TOP_RATED);

  /* ATIVIDADE */

  if ((modules.activity || 0) >= 90)
    seals.push(SEALS.ACTIVE_PRO);

  /* RANKING */

  if (ranking.position === 1)
    seals.push(SEALS.CITY_LEADER);

  else if (ranking.position <= 3)
    seals.push(SEALS.TOP3_CITY);

  else if (ranking.position <= 10)
    seals.push(SEALS.TOP10_CITY);

  /* DESTAQUE */

  if (

    score >= 95 &&

    (modules.activity || 0) >= 90 &&

    (modules.reviews || 0) >= 95 &&

    (modules.response || 0) >= 90

  ) {

    seals.push(
      SEALS.TANA_HIGHLIGHT
    );

  }

  return seals.map(

    (id) => ({
      id,
      ...CATALOG[id],
    })

  );

}

module.exports = {

  SEALS,

  CATALOG,

  generateSeals,

};