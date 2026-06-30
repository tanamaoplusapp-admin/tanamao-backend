const User = require("../models/user");
const Profissional = require("../models/Profissional");
const Servico = require("../models/Servico");

const {
  PROFILE_RULES,
  SECURITY_RULES,
  MODULE_WEIGHTS,
  LEVELS,
  reviewCurve,
  experienceCurve,
} = require("../config/scoreRules");

/* ============================================================
   UTILITÁRIOS
============================================================ */

function clamp(value, min = 0, max = 1000) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value) {
  return Number(value || 0);
}

function percent(value, total) {
  if (!total) return 0;
  return (value / total) * 100;
}

function average(list) {
  if (!list || list.length === 0) return 0;

  return (
    list.reduce((sum, item) => sum + Number(item || 0), 0) /
    list.length
  );
}

function countFilled(list) {
  return list.filter(Boolean).length;
}
/* ============================================================
   PERFIL
============================================================ */

function calculateProfileScore(profissional) {
  if (!profissional) return 0;

  let score = 0;

  // Foto de perfil
  if (profissional.photoUrl) {
    score += PROFILE_RULES.photo;
  }

  // Bio
  if (
    profissional.bio &&
    profissional.bio.trim().length >= 80
  ) {
    score += PROFILE_RULES.description;
  }

  // Galeria
  if (
    Array.isArray(profissional.galeria) &&
    profissional.galeria.length >= PROFILE_RULES.galleryMin
  ) {
    score += PROFILE_RULES.gallery;
  }

  // Até 3 profissões
  if (
    Array.isArray(profissional.profissoes) &&
    profissional.profissoes.length > 0
  ) {
    score += PROFILE_RULES.professions;
  }

  // Profissões detalhadas
  if (
    Array.isArray(profissional.profissoesDetalhadas) &&
    profissional.profissoesDetalhadas.length > 0
  ) {
    score += PROFILE_RULES.specialties;
  }

  // Serviços cadastrados
  if (
    Array.isArray(profissional.servicos) &&
    profissional.servicos.length > 0
  ) {
    score += PROFILE_RULES.services || 5;
  }

  // Cidade preenchida
  if (profissional.endereco?.cidade) {
    score += PROFILE_RULES.cities;
  }

  // Telefone
  if (profissional.phone) {
    score += PROFILE_RULES.phone || 5;
  }

  // Formas de pagamento
  const pagamentos = [
    profissional.aceitaPix,
    profissional.aceitaCartao,
    profissional.aceitaDinheiro,
  ].filter(Boolean).length;

  if (pagamentos > 0) {
    score += Math.min(pagamentos * 3, 9);
  }

  // Tipos de atendimento
  if (profissional.tipoAtendimento) {
    const tipos = Object.values(profissional.tipoAtendimento)
      .filter(Boolean).length;

    score += Math.min(tipos * 2, 6);
  }

  // Disponibilidade
  const disponibilidade = [
    profissional.atendeEmergencia,
    profissional.atendeFimSemana,
    profissional.atende24h,
  ].filter(Boolean).length;

  if (disponibilidade > 0) {
    score += Math.min(disponibilidade * 2, 6);
  }

  return clamp(score, 0, 100);
}

/* ============================================================
   SEGURANÇA
============================================================ */

function calculateSecurityScore(user) {
  let score = 0;

  if (!user) return 0;

  if (user.emailVerificado)
    score += SECURITY_RULES.email;

  if (user.telefoneVerificado)
    score += SECURITY_RULES.phone;

  if (user.documentoVerificado)
    score += SECURITY_RULES.document;

  if (user.selfieVerificada)
    score += SECURITY_RULES.selfie;

  return clamp(score, 0, 100);
}

/* ============================================================
   EXPERIÊNCIA
============================================================ */

function calculateExperienceScore(profissional) {
  if (!profissional) return 0;

  const atendimentos = normalize(
    profissional.metrics?.servicosFinalizados
  );

  return experienceCurve(atendimentos);
}
/* ============================================================
   AVALIAÇÕES
============================================================ */

function calculateReviewScore(profissional) {
  if (!profissional) return 0;

  const media = normalize(profissional.metrics?.mediaAvaliacoes);
const quantidade = normalize(profissional.metrics?.totalAvaliacoes);

  if (quantidade === 0) {
    return 0;
  }

  // Peso da nota (0–70)
  const notaScore = (Math.min(media, 5) / 5) * 70;

  // Peso da quantidade de avaliações (0–30)
  const quantidadeScore = reviewCurve(quantidade);

  return clamp(notaScore + quantidadeScore, 0, 100);
}

/* ============================================================
   PONTUALIDADE
============================================================ */

async function calculatePunctualityScore() {
  // O sistema ainda não possui registro de horário
  // suficiente para medir pontualidade real.
  // Por enquanto não penalizamos o profissional.

  return 100;
}

/* ============================================================
   CANCELAMENTOS
============================================================ */

async function calculateCancellationScore(profissional) {
  if (!profissional) return 100;

 const total = await Servico.countDocuments({
    profissional: profissional.userId,
    status: {
        $in: [
            "finalizado",
            "cancelado"
        ]
    }
});
  if (total === 0) {
    return 100;
  }

  const cancelados = await Servico.countDocuments({
    profissional: profissional.userId,
    status: "cancelado",
  });

  const taxa = (cancelados / total) * 100;

  if (taxa <= 2) return 100;
  if (taxa <= 5) return 95;
  if (taxa <= 10) return 85;
  if (taxa <= 20) return 70;
  if (taxa <= 30) return 50;
  if (taxa <= 50) return 30;

  return 10;
}
/* ============================================================
   RESPOSTA AO CLIENTE
============================================================ */

async function calculateResponseScore(profissional) {

  if (!profissional) return 100;

  const servicos = await Servico.find({

    profissional: profissional.userId,

    status: {
      $in: ["aceito", "finalizado"]
    }

  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("tempoRespostaSegundos");

  const validos = servicos.filter(
    (s) =>
      s.tempoRespostaSegundos !== null &&
      s.tempoRespostaSegundos !== undefined
  );

  if (validos.length === 0) {
    return 100;
  }

  const mediaSegundos =
    validos.reduce(
      (total, servico) =>
        total + Number(servico.tempoRespostaSegundos || 0),
      0
    ) / validos.length;

  const minutos = mediaSegundos / 60;

  if (minutos <= 2) return 100;
  if (minutos <= 5) return 95;
  if (minutos <= 10) return 90;
  if (minutos <= 20) return 80;
  if (minutos <= 30) return 70;
  if (minutos <= 60) return 55;
  if (minutos <= 120) return 35;

  return 15;

}
/* ============================================================
   SCORE FINAL
============================================================ */

function calculateFinalScore(modules) {
  const score =
    (modules.profile * MODULE_WEIGHTS.profile) +
    (modules.security * MODULE_WEIGHTS.security) +
    (modules.experience * MODULE_WEIGHTS.experience) +
    (modules.reviews * MODULE_WEIGHTS.reviews) +
    (modules.punctuality * MODULE_WEIGHTS.punctuality) +
    (modules.cancellations * MODULE_WEIGHTS.cancellations) +
    (modules.response * MODULE_WEIGHTS.response);

  return Math.round(clamp(score, 0, 100));
}

/* ============================================================
   NÍVEL
============================================================ */

function calculateLevel(score) {
  for (const level of LEVELS) {
    if (score >= level.min && score <= level.max) {
      return level;
    }
  }

  return LEVELS[0];
}
/* ============================================================
   BUSCA PROFISSIONAL
============================================================ */

async function findProfessional(identifier) {
  if (!identifier) {
    throw new Error("Identificador do profissional não informado.");
  }

  // Primeiro tenta pelo _id da coleção Profissional
  let profissional = await Profissional.findById(identifier);

  if (profissional) {
    return profissional;
  }

  // Depois tenta pelo userId
  profissional = await Profissional.findOne({
    userId: identifier,
  });

  if (profissional) {
    return profissional;
  }

  throw new Error("Profissional não encontrado.");
}
/* ============================================================
   CÁLCULO COMPLETO
============================================================ */

async function calculateScore(profissionalId) {

  const profissional = await findProfessional(profissionalId);

  const user = await User.findById(profissional.userId);

  const modules = {

    profile: calculateProfileScore(profissional),

    security: calculateSecurityScore(user),

    experience: calculateExperienceScore(profissional),

    reviews: calculateReviewScore(profissional),

    // Ainda não implementados no app
    punctuality: 100,

    cancellations: 100,

    response: 100,

  };

  const finalScore = calculateFinalScore(modules);

  const level = calculateLevel(finalScore);

  return {
    score: finalScore,
    level,
    modules,
  };

}
/* ============================================================
   ATUALIZAÇÃO DO SCORE
============================================================ */

async function updateScore(profissionalId) {
  const resultado = await calculateScore(profissionalId);

const profissional = await findProfessional(profissionalId);

await Profissional.findByIdAndUpdate(
    profissional._id,
    {
      tanaScore: resultado.score,

      tanaLevel: resultado.level.name,

      tanaLevelColor: resultado.level.color,

      tanaModules: {
        profile: resultado.modules.profile,
        security: resultado.modules.security,
        experience: resultado.modules.experience,
        reviews: resultado.modules.reviews,
        punctuality: resultado.modules.punctuality,
        cancellations: resultado.modules.cancellations,
        response: resultado.modules.response,
      },

      tanaScoreUpdatedAt: new Date(),
    },
    {
      new: true,
    }
  );

  return resultado;
}

/* ============================================================
   RECÁLCULO EM LOTE
============================================================ */

async function updateAllScores() {
  const profissionais = await Profissional.find({}, "_id");

  const resultados = [];

  for (const profissional of profissionais) {
    try {
      const resultado = await updateScore(profissional._id);

      resultados.push({
        profissionalId: profissional._id,
        success: true,
        score: resultado.score,
      });
    } catch (error) {
      resultados.push({
        profissionalId: profissional._id,
        success: false,
        error: error.message,
      });
    }
  }

  return resultados;
}
/* ============================================================
   DICAS DE EVOLUÇÃO
============================================================ */

function generateEvolutionTips(profissional, modules) {

  const tips = [];

  if (modules.profile < 100) {
    tips.push({
      title: "Complete seu perfil",
      description: "Adicione mais informações, fotos e serviços.",
      points: 5,
    });
  }

  if (modules.security < 100) {
    tips.push({
      title: "Verifique sua conta",
      description: "Complete as verificações de segurança.",
      points: 10,
    });
  }

  if (modules.experience < 80) {
    tips.push({
      title: "Conclua mais serviços",
      description: "Ganhe experiência atendendo mais clientes.",
      points: 5,
    });
  }

  if (modules.response < 90) {
    tips.push({
      title: "Responda mais rápido",
      description: "Clientes valorizam respostas rápidas.",
      points: 3,
    });
  }

  if (modules.cancellations < 100) {
    tips.push({
      title: "Evite cancelamentos",
      description: "Cancelamentos reduzem seu desempenho.",
      points: 5,
    });
  }

  return tips;
}
/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  calculateProfileScore,
  calculateSecurityScore,
  calculateExperienceScore,
  calculateReviewScore,
  calculatePunctualityScore,
  calculateCancellationScore,
  calculateResponseScore,

  calculateFinalScore,
  calculateLevel,
  calculateScore,

  updateScore,
  updateAllScores,
  generateEvolutionTips,
};