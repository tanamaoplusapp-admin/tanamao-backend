/**
 * ============================================================
 * TanaMatch™ Service
 * ------------------------------------------------------------
 * Motor inteligente de compatibilidade do Tanamão+.
 *
 * RESPONSABILIDADE:
 *
 * Determinar quais profissionais possuem maior compatibilidade
 * com uma necessidade específica do cliente.
 *
 * O TanaMatch NÃO substitui:
 *
 * • TanaScore™
 * • SearchScore™
 * • Ranking Regional
 *
 * ARQUITETURA:
 *
 * TanaScore™
 *   → mede a qualidade geral do profissional.
 *
 * SearchScore™
 *   → mede a relevância geral nas buscas.
 *
 * TanaMatch™
 *   → mede a compatibilidade entre profissional e necessidade.
 *
 * RESULTADO:
 *
 * matchScore: 0 até 100
 *
 * ============================================================
 */

"use strict";

/* ============================================================
   CONFIGURAÇÕES
============================================================ */

/**
 * Pesos oficiais do TanaMatch™.
 *
 * A soma deve permanecer igual a 1.
 *
 * Mantidos centralizados para permitir futura migração para:
 *
 * • configuração administrativa;
 * • testes A/B;
 * • personalização regional;
 * • Machine Learning.
 */

const MATCH_WEIGHTS = Object.freeze({
  compatibility: 0.30,
  distance: 0.20,
  tanaScore: 0.15,
  reviews: 0.10,
  availability: 0.10,
  response: 0.05,
  experience: 0.05,
  reputation: 0.05,
});

/**
 * Configurações geográficas.
 */

const GEO_CONFIG = Object.freeze({
  MAX_RELEVANT_DISTANCE_KM: 50,
  EARTH_RADIUS_KM: 6371,
});

/**
 * Pontuação dos selos.
 *
 * O valor representa a importância relativa de cada selo
 * dentro do módulo de reputação do TanaMatch.
 */

const SEAL_POINTS = Object.freeze({
  bronze: 5,
  silver: 10,
  gold: 20,
  diamond: 30,
  elite: 40,

  complete_profile: 10,
  fast_response: 20,
  specialist: 20,
  top_rated: 25,
  active_pro: 15,

  top10_city: 15,
  top3_city: 25,
  city_leader: 35,

  tana_highlight: 40,
});

/* ============================================================
   UTILITÁRIOS
============================================================ */

/**
 * Limita um número entre mínimo e máximo.
 */

function clamp(value, min = 0, max = 100) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(max, numericValue)
  );
}

/**
 * Normaliza valores numéricos.
 */

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

/**
 * Normaliza strings.
 *
 * Remove:
 *
 * • acentos;
 * • diferenças entre maiúsculas/minúsculas;
 * • espaços extras.
 */

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Converte qualquer identificador para String.
 *
 * Compatível com:
 *
 * • ObjectId;
 * • String;
 * • documentos populados.
 */

function normalizeId(value) {
  if (!value) {
    return "";
  }

  if (value._id) {
    return String(value._id);
  }

  return String(value);
}

/**
 * Verifica igualdade segura entre IDs.
 */

function sameId(first, second) {
  const firstId = normalizeId(first);
  const secondId = normalizeId(second);

  if (!firstId || !secondId) {
    return false;
  }

  return firstId === secondId;
}

/* ============================================================
   GEOLOCALIZAÇÃO
============================================================ */

/**
 * Converte graus para radianos.
 */

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Extrai coordenadas do profissional.
 *
 * Formato esperado no sistema:
 *
 * geo.coordinates = [longitude, latitude]
 */

function getProfessionalCoordinates(profissional) {
  const coordinates =
    profissional?.geo?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  ) {
    return null;
  }

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

/**
 * Extrai coordenadas da necessidade/serviço.
 *
 * Compatível com:
 *
 * location.coordinates
 *
 * ou:
 *
 * latitude
 * longitude
 */

function getRequestCoordinates(context = {}) {
  const locationCoordinates =
    context?.location?.coordinates;

  if (
    Array.isArray(locationCoordinates) &&
    locationCoordinates.length === 2
  ) {
    const longitude =
      Number(locationCoordinates[0]);

    const latitude =
      Number(locationCoordinates[1]);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      return {
        latitude,
        longitude,
      };
    }
  }

  const latitude = Number(context.latitude);
  const longitude = Number(context.longitude);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return {
      latitude,
      longitude,
    };
  }

  return null;
}

/**
 * Calcula distância entre dois pontos geográficos.
 *
 * Fórmula de Haversine.
 *
 * Resultado em quilômetros.
 */

function calculateDistanceKm(
  firstCoordinates,
  secondCoordinates
) {
  if (
    !firstCoordinates ||
    !secondCoordinates
  ) {
    return null;
  }

  const lat1 =
    degreesToRadians(
      firstCoordinates.latitude
    );

  const lat2 =
    degreesToRadians(
      secondCoordinates.latitude
    );

  const deltaLatitude =
    degreesToRadians(
      secondCoordinates.latitude -
        firstCoordinates.latitude
    );

  const deltaLongitude =
    degreesToRadians(
      secondCoordinates.longitude -
        firstCoordinates.longitude
    );

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLongitude / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    GEO_CONFIG.EARTH_RADIUS_KM * c
  );
}

/* ============================================================
   COMPATIBILIDADE
============================================================ */

/**
 * Calcula compatibilidade profissional/necessidade.
 *
 * Considera:
 *
 * • profissão;
 * • categoria;
 * • serviço;
 * • socorro automotivo.
 */

function calculateCompatibilityScore(
  profissional,
  context = {}
) {
  let score = 0;
  let criteriaAvailable = 0;

  /* ============================
     PROFISSÃO
  ============================ */

  if (context.profissaoId) {
    criteriaAvailable += 40;

    const principalMatch =
      sameId(
        profissional.profissaoId,
        context.profissaoId
      );

    const detailedMatch =
      Array.isArray(
        profissional.profissoesDetalhadas
      ) &&
      profissional.profissoesDetalhadas.some(
        (item) =>
          sameId(
            item?.profissaoId,
            context.profissaoId
          )
      );

    if (principalMatch || detailedMatch) {
      score += 40;
    }
  }

  /* ============================
     CATEGORIA
  ============================ */

  if (context.categoriaId) {
    criteriaAvailable += 25;

    const principalMatch =
      sameId(
        profissional.categoriaId,
        context.categoriaId
      );

    const detailedMatch =
      Array.isArray(
        profissional.profissoesDetalhadas
      ) &&
      profissional.profissoesDetalhadas.some(
        (item) =>
          sameId(
            item?.categoriaId,
            context.categoriaId
          )
      );

    if (principalMatch || detailedMatch) {
      score += 25;
    }
  }

  /* ============================
     NOME DO SERVIÇO
  ============================ */

  const requestedService =
    normalizeText(
      context.servicoNome ||
        context.serviceName ||
        context.query
    );

  if (requestedService) {
    criteriaAvailable += 25;

    const services =
      Array.isArray(profissional.servicos)
        ? profissional.servicos
        : [];

    const serviceMatch =
      services.some((service) => {
        const serviceName =
          normalizeText(
            service?.nome || service
          );

        if (!serviceName) {
          return false;
        }

        return (
          serviceName === requestedService ||
          serviceName.includes(
            requestedService
          ) ||
          requestedService.includes(
            serviceName
          )
        );
      });

    const professionNameMatch =
      Array.isArray(
        profissional.profissoesDetalhadas
      ) &&
      profissional.profissoesDetalhadas.some(
        (item) => {
          const name =
            normalizeText(item?.nome);

          return (
            name &&
            (
              name === requestedService ||
              name.includes(requestedService) ||
              requestedService.includes(name)
            )
          );
        }
      );

    if (
      serviceMatch ||
      professionNameMatch
    ) {
      score += 25;
    }
  }

  /* ============================
     SOCORRO AUTOMOTIVO
  ============================ */

  if (context.servicoEmergencial) {
    criteriaAvailable += 10;

    const emergencyServices =
      Array.isArray(
        profissional.servicosSocorroAutomotivo
      )
        ? profissional.servicosSocorroAutomotivo
        : [];

    if (
      profissional.socorristaAutomotivo === true &&
      emergencyServices.includes(
        context.servicoEmergencial
      )
    ) {
      score += 10;
    }
  }

  /**
   * Quando não existe contexto suficiente,
   * retorna valor neutro.
   *
   * Isso evita penalizar buscas genéricas.
   */

  if (criteriaAvailable === 0) {
    return 50;
  }

  return clamp(
    (score / criteriaAvailable) * 100
  );
}

/* ============================================================
   DISTÂNCIA
============================================================ */

function calculateDistanceScore(
  profissional,
  context = {}
) {
  const professionalCoordinates =
    getProfessionalCoordinates(profissional);

  const requestCoordinates =
    getRequestCoordinates(context);

  /**
   * Sem localização suficiente:
   *
   * valor neutro para não excluir profissionais
   * antigos sem coordenadas.
   */

  if (
    !professionalCoordinates ||
    !requestCoordinates
  ) {
    return {
      score: 50,
      distanceKm: null,
    };
  }

  const distanceKm =
    calculateDistanceKm(
      requestCoordinates,
      professionalCoordinates
    );

  if (distanceKm === null) {
    return {
      score: 50,
      distanceKm: null,
    };
  }

  /**
   * Curva de relevância geográfica.
   */

  let score;

  if (distanceKm <= 2) {
    score = 100;
  } else if (distanceKm <= 5) {
    score = 95;
  } else if (distanceKm <= 10) {
    score = 85;
  } else if (distanceKm <= 20) {
    score = 70;
  } else if (distanceKm <= 30) {
    score = 55;
  } else if (
    distanceKm <=
    GEO_CONFIG.MAX_RELEVANT_DISTANCE_KM
  ) {
    score = 35;
  } else {
    score = 10;
  }

  return {
    score,
    distanceKm:
      Math.round(distanceKm * 10) / 10,
  };
}

/* ============================================================
   TANASCORE
============================================================ */

function calculateTanaScore(profissional) {
  return clamp(
    profissional?.metrics?.tanaScore ??
    profissional?.tanaScore ??
    0
  );
}

/* ============================================================
   AVALIAÇÕES
============================================================ */

function calculateReviewsScore(profissional) {
  const metrics =
    profissional?.metrics || {};

  const average =
    normalizeNumber(
      metrics.mediaAvaliacoes
    );

  const total =
    normalizeNumber(
      metrics.totalAvaliacoes
    );

  if (total <= 0) {
    return 0;
  }

  /**
   * Nota:
   *
   * máximo 75 pontos.
   */

  const averageScore =
    (clamp(average, 0, 5) / 5) * 75;

  /**
   * Quantidade:
   *
   * máximo 25 pontos.
   */

  let quantityScore = 0;

  if (total >= 100) {
    quantityScore = 25;
  } else if (total >= 50) {
    quantityScore = 22;
  } else if (total >= 20) {
    quantityScore = 18;
  } else if (total >= 10) {
    quantityScore = 14;
  } else if (total >= 5) {
    quantityScore = 10;
  } else {
    quantityScore = 5;
  }

  return clamp(
    averageScore + quantityScore
  );
}

/* ============================================================
   DISPONIBILIDADE
============================================================ */

function calculateAvailabilityScore(
  profissional,
  context = {}
) {
  let score = 0;

  /**
   * Status operacional.
   */

  if (
    profissional.operationalStatus ===
    "disponivel"
  ) {
    score += 40;
  } else if (
    profissional.operationalStatus ===
    "em_atendimento"
  ) {
    score += 10;
  }

  /**
   * Online.
   */

  if (profissional.online === true) {
    score += 25;
  }

  /**
   * Serviço imediato.
   */

  if (
    context.immediate === true ||
    context.urgente === true
  ) {
    if (
      profissional.aceitaServicoImediato ===
      true
    ) {
      score += 20;
    }

    if (
      profissional.atendeEmergencia === true
    ) {
      score += 15;
    }
  } else {
    /**
     * Em buscas normais não penalizamos
     * profissionais que não atendem emergência.
     */

    score += 35;
  }

  return clamp(score);
}

/* ============================================================
   TEMPO DE RESPOSTA
============================================================ */

function calculateResponseScore(profissional) {
  return clamp(
    profissional?.metrics?.tanaModules?.response ??
    profissional?.tanaModules?.response ??
    50
  );
}
/* ============================================================
   EXPERIÊNCIA
============================================================ */

function calculateExperienceScore(profissional) {
  return clamp(
    profissional?.metrics?.tanaModules?.experience ??
    profissional?.tanaModules?.experience ??
    0
  );
}

/* ============================================================
   REPUTAÇÃO / SELOS
============================================================ */

/**
 * Extrai ID do selo.
 *
 * Compatível com:
 *
 * ["gold"]
 *
 * e:
 *
 * [
 *   {
 *     id: "gold",
 *     title: "Ouro"
 *   }
 * ]
 */

function getSealId(seal) {
  if (!seal) {
    return "";
  }

  if (typeof seal === "string") {
    return seal;
  }

  return seal.id || "";
}

function calculateReputationScore(profissional) {
  const seals =
    profissional?.metrics?.tanaSeals ??
    profissional?.tanaSeals ??
    [];

  if (!Array.isArray(seals) || seals.length === 0) {
    return 0;
  }

  const totalPoints = seals.reduce(
    (total, seal) => {
      const sealId = getSealId(seal);

      return (
        total +
        normalizeNumber(
          SEAL_POINTS[sealId]
        )
      );
    },
    0
  );

  return clamp(totalPoints);
}
/* ============================================================
   CONTEXTO DE URGÊNCIA
============================================================ */

/**
 * Pequeno ajuste contextual aplicado após
 * o cálculo principal.
 *
 * Não altera os pesos estruturais do algoritmo.
 */

function calculateContextBonus(
  profissional,
  context = {}
) {
  let bonus = 0;

  if (
    context.urgente === true ||
    context.immediate === true
  ) {
    if (
      profissional.online === true &&
      profissional.operationalStatus ===
        "disponivel"
    ) {
      bonus += 3;
    }

    if (
      profissional.aceitaServicoImediato ===
      true
    ) {
      bonus += 2;
    }

    if (
      profissional.atendeEmergencia === true
    ) {
      bonus += 2;
    }
  }

  return Math.min(bonus, 7);
}

/* ============================================================
   CÁLCULO PRINCIPAL
============================================================ */

/**
 * Calcula o TanaMatch™ de um profissional.
 */

function calculateTanaMatch(
  profissional,
  context = {}
) {
  if (!profissional) {
    return {
      matchScore: 0,
      distanceKm: null,
      modules: {},
    };
  }

  const compatibility =
    calculateCompatibilityScore(
      profissional,
      context
    );

  const distanceResult =
    calculateDistanceScore(
      profissional,
      context
    );

  const tanaScore =
    calculateTanaScore(profissional);

  const reviews =
    calculateReviewsScore(profissional);

  const availability =
    calculateAvailabilityScore(
      profissional,
      context
    );

  const response =
    calculateResponseScore(profissional);

  const experience =
    calculateExperienceScore(profissional);

  const reputation =
    calculateReputationScore(profissional);

  const modules = {
    compatibility:
      Math.round(compatibility),

    distance:
      Math.round(distanceResult.score),

    tanaScore:
      Math.round(tanaScore),

    reviews:
      Math.round(reviews),

    availability:
      Math.round(availability),

    response:
      Math.round(response),

    experience:
      Math.round(experience),

    reputation:
      Math.round(reputation),
  };

  const weightedScore =
    modules.compatibility *
      MATCH_WEIGHTS.compatibility +

    modules.distance *
      MATCH_WEIGHTS.distance +

    modules.tanaScore *
      MATCH_WEIGHTS.tanaScore +

    modules.reviews *
      MATCH_WEIGHTS.reviews +

    modules.availability *
      MATCH_WEIGHTS.availability +

    modules.response *
      MATCH_WEIGHTS.response +

    modules.experience *
      MATCH_WEIGHTS.experience +

    modules.reputation *
      MATCH_WEIGHTS.reputation;

  const contextBonus =
    calculateContextBonus(
      profissional,
      context
    );

  const matchScore =
    Math.round(
      clamp(
        weightedScore + contextBonus
      )
    );

  return {
    matchScore,

    distanceKm:
      distanceResult.distanceKm,

    modules,

    contextBonus,
  };
}

/* ============================================================
   ENRIQUECIMENTO
============================================================ */

/**
 * Adiciona informações do TanaMatch ao profissional
 * sem alterar o objeto original.
 */

function enrichProfessionalWithMatch(
  profissional,
  context = {}
) {
  const result =
    calculateTanaMatch(
      profissional,
      context
    );

  return {
    ...profissional,

    matchScore:
      result.matchScore,

    matchDistanceKm:
      result.distanceKm,

    matchModules:
      result.modules,

    matchContextBonus:
      result.contextBonus,
  };
}

/* ============================================================
   ORDENAÇÃO
============================================================ */

/**
 * Ordena profissionais utilizando:
 *
 * 1. TanaMatch
 * 2. SearchScore
 * 3. TanaScore
 * 4. Avaliação
 * 5. Quantidade de avaliações
 */

function sortProfessionalsByMatch(
  profissionais = [],
  context = {}
) {
  if (!Array.isArray(profissionais)) {
    return [];
  }

  return profissionais
    .map((profissional) =>
      enrichProfessionalWithMatch(
        profissional,
        context
      )
    )
    .sort((first, second) => {
      /* ============================
         1. TANAMATCH
      ============================ */

      if (
        second.matchScore !==
        first.matchScore
      ) {
        return (
          second.matchScore -
          first.matchScore
        );
      }


/* ============================
   2. SEARCHSCORE
============================ */

const firstSearchScore =
  normalizeNumber(
    first?.metrics?.searchScore ??
    first?.searchScore
  );

const secondSearchScore =
  normalizeNumber(
    second?.metrics?.searchScore ??
    second?.searchScore
  );

if (secondSearchScore !== firstSearchScore) {
  return secondSearchScore - firstSearchScore;
}

/* ============================
   3. TANASCORE
============================ */

const firstTanaScore =
  normalizeNumber(
    first?.metrics?.tanaScore ??
    first?.tanaScore
  );

const secondTanaScore =
  normalizeNumber(
    second?.metrics?.tanaScore ??
    second?.tanaScore
  );

if (secondTanaScore !== firstTanaScore) {
  return secondTanaScore - firstTanaScore;
}
      /* ============================
         4. MÉDIA DE AVALIAÇÕES
      ============================ */

      const firstAverage =
        normalizeNumber(
          first.metrics?.mediaAvaliacoes
        );

      const secondAverage =
        normalizeNumber(
          second.metrics?.mediaAvaliacoes
        );

      if (
        secondAverage !== firstAverage
      ) {
        return (
          secondAverage -
          firstAverage
        );
      }

      /* ============================
         5. TOTAL DE AVALIAÇÕES
      ============================ */

      return (
        normalizeNumber(
          second.metrics?.totalAvaliacoes
        ) -
        normalizeNumber(
          first.metrics?.totalAvaliacoes
        )
      );
    });
}

/* ============================================================
   SELEÇÃO DE MELHORES CANDIDATOS
============================================================ */

/**
 * Retorna apenas os melhores candidatos.
 *
 * Preparado para utilização futura em:
 *
 * • distribuição automática de serviços;
 * • notificações em ondas;
 * • serviço imediato;
 * • socorro automotivo;
 * • marketplace inteligente.
 */

function selectBestCandidates(
  profissionais = [],
  context = {},
  options = {}
) {
  const {
    limit = 10,
    minimumScore = 0,
  } = options;

  const sorted =
    sortProfessionalsByMatch(
      profissionais,
      context
    );

  return sorted
    .filter(
      (profissional) =>
        profissional.matchScore >=
        minimumScore
    )
    .slice(
      0,
      Math.max(0, limit)
    );
}

/* ============================================================
   ESTATÍSTICAS
============================================================ */

/**
 * Gera informações agregadas do resultado.
 *
 * Útil futuramente para:
 *
 * • TanaInsights™;
 * • Dashboard;
 * • métricas administrativas;
 * • análise do algoritmo.
 */

function generateMatchStats(
  profissionais = []
) {
  if (
    !Array.isArray(profissionais) ||
    profissionais.length === 0
  ) {
    return {
      totalCandidates: 0,
      averageMatchScore: 0,
      highestMatchScore: 0,
      lowestMatchScore: 0,
    };
  }

  const scores =
    profissionais
      .map((item) =>
        normalizeNumber(item.matchScore)
      )
      .filter(Number.isFinite);

  if (scores.length === 0) {
    return {
      totalCandidates:
        profissionais.length,

      averageMatchScore: 0,
      highestMatchScore: 0,
      lowestMatchScore: 0,
    };
  }

  const total =
    scores.reduce(
      (sum, score) => sum + score,
      0
    );

  return {
    totalCandidates:
      profissionais.length,

    averageMatchScore:
      Math.round(total / scores.length),

    highestMatchScore:
      Math.max(...scores),

    lowestMatchScore:
      Math.min(...scores),
  };
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  MATCH_WEIGHTS,
  GEO_CONFIG,

  calculateDistanceKm,

  calculateCompatibilityScore,
  calculateDistanceScore,
  calculateReviewsScore,
  calculateAvailabilityScore,
  calculateReputationScore,

  calculateTanaMatch,

  enrichProfessionalWithMatch,

  sortProfessionalsByMatch,

  selectBestCandidates,

  generateMatchStats,
};