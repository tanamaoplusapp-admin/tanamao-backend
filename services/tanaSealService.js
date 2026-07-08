/**
 * ============================================================
 * TanaSealService™
 * ------------------------------------------------------------
 * Selos Oficiais do Tanamão+.
 *
 * COMPATIBILIDADE:
 *
 * Arquitetura atual:
 * • metrics.tanaScore
 * • metrics.tanaModules
 *
 * Compatibilidade antiga:
 * • tanaScore
 * • tanaModules
 *
 * IMPORTANTE:
 *
 * generateSeals() retorna objetos completos para uso no app.
 *
 * Ao persistir no MongoDB, o scoreService deve salvar apenas
 * os IDs dos selos em metrics.tanaSeals.
 * ============================================================
 */

"use strict";

/* ============================================================
   SELOS
============================================================ */

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
   UTILITÁRIOS
============================================================ */

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

/**
 * Prioridade:
 *
 * 1. metrics.tanaScore
 * 2. tanaScore
 */

function getTanaScore(profissional) {
  return normalizeNumber(
    profissional?.metrics?.tanaScore ??
      profissional?.tanaScore ??
      0
  );
}

/**
 * Prioridade:
 *
 * 1. metrics.tanaModules
 * 2. tanaModules
 */

function getTanaModules(profissional) {
  return (
    profissional?.metrics?.tanaModules ??
    profissional?.tanaModules ??
    {}
  );
}

/* ============================================================
   CONVERSÃO DE SELOS
============================================================ */

/**
 * Converte um ID em objeto completo.
 */

function getSealById(id) {
  if (!id || !CATALOG[id]) {
    return null;
  }

  return {
    id,
    ...CATALOG[id],
  };
}

/**
 * Converte lista de IDs em objetos completos.
 */

function hydrateSeals(seals = []) {
  if (!Array.isArray(seals)) {
    return [];
  }

  return seals
    .map((seal) => {
      if (typeof seal === "string") {
        return getSealById(seal);
      }

      if (
        seal &&
        typeof seal === "object" &&
        seal.id
      ) {
        return getSealById(seal.id);
      }

      return null;
    })
    .filter(Boolean);
}

/**
 * Extrai apenas os IDs.
 *
 * Útil para persistência.
 */

function extractSealIds(seals = []) {
  if (!Array.isArray(seals)) {
    return [];
  }

  return [
    ...new Set(
      seals
        .map((seal) => {
          if (typeof seal === "string") {
            return seal;
          }

          return seal?.id;
        })
        .filter(
          (id) =>
            Boolean(id) &&
            Boolean(CATALOG[id])
        )
    ),
  ];
}

/* ============================================================
   GERAÇÃO DOS SELOS
============================================================ */

function generateSeals(
  profissional,
  ranking = {}
) {
  if (!profissional) {
    return [];
  }

  const sealIds = [];

  const score =
    getTanaScore(profissional);

  const modules =
    getTanaModules(profissional);

  /* ============================================================
     SCORE
  ============================================================ */

  if (score >= 40) {
    sealIds.push(SEALS.BRONZE);
  }

  if (score >= 60) {
    sealIds.push(SEALS.SILVER);
  }

  if (score >= 75) {
    sealIds.push(SEALS.GOLD);
  }

  if (score >= 90) {
    sealIds.push(SEALS.DIAMOND);
  }

  if (score >= 95) {
    sealIds.push(SEALS.ELITE);
  }

  /* ============================================================
     PERFIL
  ============================================================ */

  if (
    normalizeNumber(modules.profile) === 100
  ) {
    sealIds.push(
      SEALS.COMPLETE_PROFILE
    );
  }

  /* ============================================================
     RESPOSTA
  ============================================================ */

  if (
    normalizeNumber(modules.response) >= 90
  ) {
    sealIds.push(
      SEALS.FAST_RESPONSE
    );
  }

  /* ============================================================
     EXPERIÊNCIA
  ============================================================ */

  if (
    normalizeNumber(modules.experience) >= 90
  ) {
    sealIds.push(
      SEALS.SPECIALIST
    );
  }

  /* ============================================================
     AVALIAÇÕES
  ============================================================ */

  if (
    normalizeNumber(modules.reviews) >= 95
  ) {
    sealIds.push(
      SEALS.TOP_RATED
    );
  }

  /* ============================================================
     ATIVIDADE
  ============================================================ */

  if (
    normalizeNumber(modules.activity) >= 90
  ) {
    sealIds.push(
      SEALS.ACTIVE_PRO
    );
  }

  /* ============================================================
     RANKING
  ============================================================ */

  const rankingPosition =
    normalizeNumber(ranking?.position);

  if (rankingPosition > 0) {
    if (rankingPosition === 1) {
      sealIds.push(
        SEALS.CITY_LEADER
      );
    } else if (
      rankingPosition <= 3
    ) {
      sealIds.push(
        SEALS.TOP3_CITY
      );
    } else if (
      rankingPosition <= 10
    ) {
      sealIds.push(
        SEALS.TOP10_CITY
      );
    }
  }

  /* ============================================================
     DESTAQUE TANAMÃO
  ============================================================ */

  if (
    score >= 95 &&
    normalizeNumber(modules.activity) >= 90 &&
    normalizeNumber(modules.reviews) >= 95 &&
    normalizeNumber(modules.response) >= 90
  ) {
    sealIds.push(
      SEALS.TANA_HIGHLIGHT
    );
  }

  /* ============================================================
     REMOVE DUPLICADOS E HIDRATA
  ============================================================ */

  return hydrateSeals(
    [...new Set(sealIds)]
  );
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  SEALS,

  CATALOG,

  getTanaScore,

  getTanaModules,

  getSealById,

  hydrateSeals,

  extractSealIds,

  generateSeals,
};