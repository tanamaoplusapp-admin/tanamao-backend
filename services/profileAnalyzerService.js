/**
 * ============================================================
 * TanaProfile™
 * Profile Analyzer Service
 * ------------------------------------------------------------
 * Responsável por buscar os dados do profissional
 * e executar o Recommendation Engine.
 * ============================================================
 */

const User = require("../models/user");
const Profissional = require("../models/Profissional");
const Servico = require("../models/Servico");

const recommendationEngine = require(
  "../engines/profileRecommendationEngine"
);

/* ============================================================
   BUSCAR PROFISSIONAL
============================================================ */

async function findProfessional(identifier) {

  if (!identifier) {
    throw new Error("Profissional não informado.");
  }

  let profissional =
    await Profissional.findById(identifier);

  if (profissional) {
    return profissional;
  }

  profissional =
    await Profissional.findOne({
      userId: identifier,
    });

  if (profissional) {
    return profissional;
  }

  throw new Error("Profissional não encontrado.");

}

/* ============================================================
   CARREGA MÉTRICAS
============================================================ */

async function loadMetrics(profissional) {

  const totalServicos =
    await Servico.countDocuments({

      profissional: profissional.userId,

      status: "finalizado",

    });

  return {

    servicosFinalizados: totalServicos,

    mediaAvaliacoes:
      profissional.metrics?.mediaAvaliacoes || 0,

    totalAvaliacoes:
      profissional.metrics?.totalAvaliacoes || 0,

    tanaScore:
      profissional.tanaScore || 0,

    tanaModules:
      profissional.tanaModules || {},

  };

}

/* ============================================================
   ANALISAR PERFIL
============================================================ */

async function analyzeProfile(identifier) {

  const profissional =
    await findProfessional(identifier);

  const user =
    await User.findById(profissional.userId);

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  const metrics =
    await loadMetrics(profissional);

  const result =
    recommendationEngine.analyze({

      ...profissional.toObject(),

      user,

      metrics,

    });

  return {

    profissionalId: profissional._id,

    userId: user._id,

    generatedAt: new Date(),

    ...result,

  };

}
/* ============================================================
   ANALISAR PERFIL DO USUÁRIO LOGADO
============================================================ */

async function analyzeMyProfile(userId) {

  if (!userId) {
    throw new Error("Usuário não informado.");
  }

  return analyzeProfile(userId);

}

/* ============================================================
   REANALISAR PERFIL
   (Preparado para futuros eventos do TanaCore)
============================================================ */

async function refreshProfileAnalysis(identifier) {

  return analyzeProfile(identifier);

}

/* ============================================================
   RESUMO RÁPIDO
============================================================ */

async function getQuickSummary(identifier) {

  const analysis =
    await analyzeProfile(identifier);

  return {

    completion:
      analysis.profileCompletion,

    level:
      analysis.level,

    missions:
      analysis.missions.slice(0, 3),

    strengths:
      analysis.strengths.slice(0, 3),

    scoreImpact:
      analysis.scoreImpact,

  };

}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {

  analyzeProfile,

  analyzeMyProfile,

  refreshProfileAnalysis,

  getQuickSummary,

};