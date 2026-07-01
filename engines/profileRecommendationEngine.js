/**
 * ============================================================
 * TanaProfile™
 * Recommendation Engine
 * ------------------------------------------------------------
 * Responsável por analisar o perfil do profissional e gerar
 * recomendações inteligentes.
 *
 * Não conhece Mongo.
 * Não conhece Express.
 * Não conhece Mongoose.
 *
 * Apenas recebe objetos.
 * ============================================================
 */

const {
  PROFILE_ANALYZER_RULES,
  PROFILE_LEVELS,
} = require("../config/profileRules");

/* ============================================================
   UTILITÁRIOS
============================================================ */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function calculateCompletion(details) {

  if (!details.length) return 0;

  const total = details.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  const obtained = details
    .filter(item => item.completed)
    .reduce(
      (sum, item) => sum + item.weight,
      0
    );

  return Math.round((obtained / total) * 100);

}

function calculateLevel(score) {

  let current = PROFILE_LEVELS[0];

  for (const level of PROFILE_LEVELS) {

    if (score >= level.min) {
      current = level;
    }

  }

  return current;

}
function getNextLevel(score) {

    const next = PROFILE_LEVELS.find(
        level => level.min > score
    );

    if (!next)
        return null;

    return {

        name: next.name,

        remaining:
            next.min - score

    };

}
/* ============================================================
   ANALISA CADA REGRA
============================================================ */

function analyzeRules(profissional) {

  const details = [];

  for (const rule of PROFILE_ANALYZER_RULES) {

    let completed = false;

    try {

      completed = !!rule.validate(profissional);

    } catch {

      completed = false;

    }

    details.push({

      key: rule.key,

      title: rule.title,

      completed,

      weight: rule.weight,

      estimatedGain: rule.estimatedGain,

      impact: rule.impact,

      estimatedTime: rule.estimatedTime,

      message: rule.message,

    });

  }

  return details;

}
/* ============================================================
   PONTOS FORTES
============================================================ */

function generateStrengths(details) {

  return details
    .filter(item => item.completed)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(item => ({
      key: item.key,
      title: item.title,
      impact: item.impact,
      gain: item.estimatedGain,
    }));

}

/* ============================================================
   PONTOS A MELHORAR
============================================================ */

function generateWeaknesses(details) {

  return details
    .filter(item => !item.completed)
    .sort((a, b) => b.weight - a.weight)
    .map(item => ({
      key: item.key,
      title: item.title,
      impact: item.impact,
      gain: item.estimatedGain,
      message: item.message,
    }));

}
/* ============================================================
   CATEGORIA
============================================================ */

function getCategory(key) {

  const map = {

    photo: "Perfil",

    gallery: "Perfil",

    bio: "Perfil",

    professions: "Perfil",

    services: "Visibilidade",

    attendance: "Atendimento",

    payments: "Confiança",

    availability: "Disponibilidade",

    location: "Localização",

  };

  return map[key] || "Geral";

}

/* ============================================================
   DIFICULDADE
============================================================ */

function getDifficulty(gain) {

  if (gain >= 12) return "Muito Fácil";

  if (gain >= 8) return "Fácil";

  if (gain >= 5) return "Média";

  return "Alta";

}

/* ============================================================
   RESULTADO ESPERADO
============================================================ */

function getExpectedResult(key) {

  const map = {

    photo:
      "Maior confiança dos clientes e mais destaque nas buscas.",

    gallery:
      "Mais credibilidade ao apresentar seus trabalhos.",

    bio:
      "Clientes entenderão melhor sua experiência.",

    services:
      "Seu perfil aparecerá em mais pesquisas.",

    professions:
      "Você poderá ser encontrado por mais categorias.",

    attendance:
      "Maior alcance para diferentes tipos de atendimento.",

    payments:
      "Aumenta a taxa de conversão dos clientes.",

    availability:
      "Mais oportunidades de receber chamados.",

    location:
      "Facilita sua localização pelos clientes.",

  };

  return map[key] || "";

}
/* ============================================================
   MISSÕES
============================================================ */

function generateMissions(details) {

  return details

    .filter(item => !item.completed)

    .sort((a, b) => {

      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }

      return b.estimatedGain - a.estimatedGain;

    })

    .map((item, index) => ({

  priority: index + 1,

  key: item.key,

  title: item.title,

  description: item.message,

  gain: item.estimatedGain,

  impact: item.impact,

  estimatedTime: item.estimatedTime,

  difficulty: getDifficulty(item.estimatedGain),

  expectedResult: getExpectedResult(item.key),

  category: getCategory(item.key),

  completed: false,

}));

}

/* ============================================================
   SCORE POTENCIAL
============================================================ */

function calculatePossibleScore(details, currentScore) {

  const remaining = details
    .filter(item => !item.completed)
    .reduce(
      (sum, item) => sum + item.weight,
      0
    );

  return clamp(currentScore + remaining);

}

function calculateVisibility(profissional){

    let score = 0;

    if(profissional.photoUrl)
        score += 20;

    if(profissional.bio?.length >= 120)
        score += 15;

    if(profissional.galeria?.length >= 5)
        score += 15;

    if(profissional.servicos?.length >= 5)
        score += 20;

    if(
        profissional.metrics?.mediaAvaliacoes >= 4.5
    )
        score += 15;

    if(
        profissional.metrics?.totalAvaliacoes >= 10
    )
        score += 15;

    return Math.min(score,100);

}
/* ============================================================
   INSIGHTS
============================================================ */

function generateInsights(
    completion,
    missions,
    profissional
) {

    const metrics = profissional.metrics || {};
    const user = profissional.user || {};
const insights = [];
  if (completion >= 90) {

    insights.push(
      "Seu perfil está entre os mais completos da plataforma."
    );

  } else if (completion >= 75) {

    insights.push(
      "Seu perfil está muito bom. Pequenos ajustes podem aumentar sua visibilidade."
    );

  } else if (completion >= 50) {

    insights.push(
      "Seu perfil possui boa base, mas ainda existem oportunidades importantes de crescimento."
    );

  } else {

    insights.push(
      "Complete seu perfil para transmitir mais confiança aos clientes."
    );

  }

  if (missions.length) {

    const first = missions[0];

    insights.push(
      `Sua prioridade deve ser: ${first.title}.`
    );

    insights.push(
      `Essa melhoria pode gerar aproximadamente +${first.gain} pontos no seu perfil.`
    );

  }
if ((metrics.totalAvaliacoes || 0) >= 10) {

    insights.push(
        "Você possui uma boa reputação baseada nas avaliações dos clientes."
    );

}

if ((metrics.servicosFinalizados || 0) >= 20) {

    insights.push(
        "Sua experiência é um diferencial competitivo."
    );

}

if ((metrics.tanaScore || 0) >= 90) {

    insights.push(
        "Você está entre os profissionais mais bem avaliados do Tanamão+."
    );

}
  return insights;

}

/* ============================================================
   MENSAGEM DE CRESCIMENTO
============================================================ */

function generateGrowthMessage(completion, level, missions) {

  if (!missions.length) {

    return `Parabéns! Seu perfil atingiu o nível ${level.name}. Continue mantendo suas informações atualizadas.`;

  }

  const principal = missions[0];

  return `Você está no nível ${level.name}. A próxima ação de maior impacto é "${principal.title}", que pode melhorar significativamente sua visibilidade dentro do Tanamão+.`;

}

/* ============================================================
   ANALISADOR PRINCIPAL
============================================================ */

function analyze(profissional = {}) {

  const details = analyzeRules(profissional);

  const completion =
    calculateCompletion(details);

  const level =
    calculateLevel(completion);
const nextLevel =
    getNextLevel(completion);
  const strengths =
    generateStrengths(details);

  const weaknesses =
    generateWeaknesses(details);

  const missions =
    generateMissions(details);

  const insights = generateInsights(
    completion,
    missions,
    profissional
);

  const possible =
    calculatePossibleScore(
      details,
      completion
    );
const visibility =
    calculateVisibility(profissional);
  return {

    profileCompletion: completion,
    visibility,

    level,
    nextLevel,

    strengths,

    weaknesses,

    missions,
highestImpactMission:
    missions[0] || null,
    insights,
    analysisDate:
    new Date(),
    isExcellent:
    completion >= 90,

    growthMessage:
      generateGrowthMessage(
        completion,
        level,
        missions
      ),

    scoreImpact:{

   current:
      profissional.metrics?.tanaScore ??
      completion,

   possible
   
}

  };

}
/* ============================================================
   EXPORTS
============================================================ */

module.exports = {

  analyze,

  analyzeRules,

  calculateCompletion,

  calculateLevel,

  generateStrengths,

  generateWeaknesses,

  generateMissions,

  generateInsights,

  generateGrowthMessage,

  calculatePossibleScore,

};