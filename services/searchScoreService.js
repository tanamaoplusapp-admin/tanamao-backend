/**
 * ============================================================
 * SearchScore™
 * ------------------------------------------------------------
 * Algoritmo proprietário de ordenação do Tanamão+.
 *
 * O SearchScore NÃO substitui o TanaScore.
 *
 * RESPONSABILIDADE:
 *
 * Definir a relevância geral do profissional nas buscas.
 *
 * COMPATIBILIDADE:
 *
 * Suporta a arquitetura atual:
 *
 * profissional.metrics.tanaScore
 * profissional.metrics.tanaModules
 * profissional.metrics.tanaSeals
 *
 * E mantém fallback para registros antigos:
 *
 * profissional.tanaScore
 * profissional.tanaModules
 * profissional.tanaSeals
 *
 * Resultado: 0 até 100.
 * ============================================================
 */

"use strict";

/* ============================================================
   UTILITÁRIOS
============================================================ */

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

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

/* ============================================================
   PESOS
============================================================ */

const WEIGHTS = Object.freeze({
  tanaScore: 0.40,

  activity: 0.20,

  reviews: 0.15,

  response: 0.10,

  experience: 0.10,

  seals: 0.05,
});

/* ============================================================
   LEITURA COMPATÍVEL DOS DADOS
============================================================ */

/**
 * Busca o TanaScore.
 *
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
 * Busca os módulos do TanaScore.
 *
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

/**
 * Busca os TanaSelos.
 *
 * Prioridade:
 *
 * 1. metrics.tanaSeals
 * 2. tanaSeals
 * 3. badges (compatibilidade antiga)
 */

function getTanaSeals(profissional) {
  const seals =
    profissional?.metrics?.tanaSeals ??
    profissional?.tanaSeals ??
    profissional?.badges ??
    [];

  return Array.isArray(seals)
    ? seals
    : [];
}

/* ============================================================
   SCORE DOS SELOS
============================================================ */

/**
 * Nesta primeira versão cada selo vale 20 pontos.
 *
 * Máximo: 100.
 *
 * Futuramente o peso individual de cada selo poderá
 * ser centralizado no TanaSealService™.
 */

function calculateSealScore(profissional) {
  const seals =
    getTanaSeals(profissional);

  return clamp(
    seals.length * 20
  );
}

/* ============================================================
   CÁLCULO
============================================================ */

function calculateSearchScore(profissional) {
  if (!profissional) {
    return 0;
  }

  const modules =
    getTanaModules(profissional);

  const tanaScore =
    getTanaScore(profissional);

  const sealScore =
    calculateSealScore(profissional);

  const score =
    (
      tanaScore *
      WEIGHTS.tanaScore
    ) +

    (
      normalizeNumber(
        modules.activity
      ) *
      WEIGHTS.activity
    ) +

    (
      normalizeNumber(
        modules.reviews
      ) *
      WEIGHTS.reviews
    ) +

    (
      normalizeNumber(
        modules.response
      ) *
      WEIGHTS.response
    ) +

    (
      normalizeNumber(
        modules.experience
      ) *
      WEIGHTS.experience
    ) +

    (
      sealScore *
      WEIGHTS.seals
    );

  return Math.round(
    clamp(score)
  );
}

/* ============================================================
   ORDENAÇÃO
============================================================ */

function sortProfessionals(
  profissionais = []
) {
  if (!Array.isArray(profissionais)) {
    return [];
  }

  return profissionais
    .map((profissional) => {
      const searchScore =
        calculateSearchScore(
          profissional
        );

      return {
        ...profissional,

        searchScore,
      };
    })

    .sort(
      (first, second) =>
        second.searchScore -
        first.searchScore
    );
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  WEIGHTS,

  getTanaScore,

  getTanaModules,

  getTanaSeals,

  calculateSealScore,

  calculateSearchScore,

  sortProfessionals,
};