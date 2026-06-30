/**
 * ============================================================
 * TanaScore™
 * Professional Evolution Engine
 * ------------------------------------------------------------
 * Responsável por combinar todos os módulos de score.
 * Não acessa banco.
 * Não conhece Express.
 * Não conhece Mongoose.
 * ============================================================
 */

const {
  MODULE_WEIGHTS,
  PROFILE_RULES,
  SECURITY_RULES,
  LEVELS,
  reviewCurve,
  experienceCurve,
} = require("../config/scoreRules");

const {
  executeRules,
  resolveLevel,
  mergeImprovements,
} = require("./ruleEngine");

/**
 * ============================================================
 * Calcula Perfil
 * ============================================================
 */

function calculateProfile(profissional) {
  return executeRules(PROFILE_RULES, profissional);
}

/**
 * ============================================================
 * Calcula Segurança
 * ============================================================
 */

function calculateSecurity(user) {
  return executeRules(SECURITY_RULES, user);
}

/**
 * ============================================================
 * Calcula Avaliações
 * ============================================================
 */

function calculateReviews(avaliacoes = []) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) {
    return {
      score: 0,
      media: 0,
      quantidade: 0,
      improvements: [
        "Conclua serviços para receber avaliações."
      ]
    };
  }

  const quantidade = avaliacoes.length;

  const soma = avaliacoes.reduce(
    (total, item) =>
      total + Number(item.nota || 0),
    0
  );

  const media = soma / quantidade;

  return {
    score: reviewCurve(media, quantidade),
    media,
    quantidade,
    improvements: []
  };
}

/**
 * ============================================================
 * Calcula Experiência
 * ============================================================
 */

function calculateExperience(servicos = []) {

  const concluidos = servicos.filter(
    s =>
      s.status === "concluido" ||
      s.status === "finalizado"
  );

  return {

    score: experienceCurve(concluidos.length),

    total: concluidos.length,

    improvements:
      concluidos.length < 10
        ? [
            "Conclua mais atendimentos para aumentar sua experiência."
          ]
        : []

  };

}

/**
 * ============================================================
 * Calcula Score Final
 * ============================================================
 */

function calculateFinal({

  user,

  profissional,

  avaliacoes,

  servicos

}) {

  const profile =
    calculateProfile(profissional);

  const reviews =
    calculateReviews(avaliacoes);

  const experience =
    calculateExperience(servicos);

  const security =
    calculateSecurity(user);

  const total =

      profile.score *
      (MODULE_WEIGHTS.profile / 100)

    +

      reviews.score *
      (MODULE_WEIGHTS.reviews / 100)

    +

      experience.score *
      (MODULE_WEIGHTS.experience / 100)

    +

      security.score *
      (MODULE_WEIGHTS.security / 100);

  const finalScore = Math.round(total);

  const level = resolveLevel(
    finalScore,
    LEVELS
  );
    const improvements = mergeImprovements(
    profile.improvements,
    reviews.improvements,
    experience.improvements,
    security.improvements
  );

  return {
    score: finalScore,

    nivel: level,

    modules: {
      profile: {
        score: profile.score,
        details: profile.details || []
      },

      reviews: {
        score: reviews.score,
        media: Number(reviews.media?.toFixed(2) || 0),
        quantidade: reviews.quantidade
      },

      experience: {
        score: experience.score,
        total: experience.total
      },

      security: {
        score: security.score,
        details: security.details || []
      }
    },

    improvements,

    generatedAt: new Date()
  };
}

module.exports = {

  calculateProfile,

  calculateReviews,

  calculateExperience,

  calculateSecurity,

  calculateFinal

};