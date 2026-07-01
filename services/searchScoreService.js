/**
 * ============================================================
 * SearchScore™
 * ------------------------------------------------------------
 * Algoritmo proprietário de ordenação do Tanamão+.
 *
 * O SearchScore NÃO substitui o TanaScore.
 *
 * O objetivo é definir quais profissionais aparecem
 * primeiro nas buscas.
 *
 * O resultado sempre varia de 0 a 100.
 * ============================================================
 */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
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

  badges: 0.05,

});

/* ============================================================
   CÁLCULO
============================================================ */

function calculateSearchScore(profissional) {

  if (!profissional) {

    return 0;

  }

  const modules = profissional.tanaModules || {};

  const tanaScore = Number(
    profissional.tanaScore || 0
  );

  const badges = Array.isArray(
    profissional.badges
  )
    ? profissional.badges.length
    : 0;

  const badgeScore = Math.min(
    badges * 20,
    100
  );

  const score =

    (tanaScore * WEIGHTS.tanaScore) +

    ((modules.activity || 0) * WEIGHTS.activity) +

    ((modules.reviews || 0) * WEIGHTS.reviews) +

    ((modules.response || 0) * WEIGHTS.response) +

    ((modules.experience || 0) * WEIGHTS.experience) +

    (badgeScore * WEIGHTS.badges);

  return Math.round(
    clamp(score)
  );

}

/* ============================================================
   ORDENAÇÃO
============================================================ */

function sortProfessionals(profissionais = []) {

  return profissionais

    .map((profissional) => ({

      ...profissional,

      searchScore:
        calculateSearchScore(profissional),

    }))

    .sort(

      (a, b) =>

        b.searchScore -

        a.searchScore

    );

}

module.exports = {

  calculateSearchScore,

  sortProfessionals,

};