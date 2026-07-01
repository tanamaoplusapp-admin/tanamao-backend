const Profissional = require("../models/Profissional");
const { LEVELS } = require("../config/scoreRules");

const {
  calculateScore,
  updateScore,
  updateAllScores,
  generateEvolutionTips,
} = require("../services/scoreService");

/**
 * Retorna o TanaScore atual do profissional
 */
exports.getScore = async (req, res) => {
  try {
    const { profissionalId } = req.params;

    const resultado = await calculateScore(profissionalId);

    return res.status(200).json({
      success: true,
      data: resultado,
    });
  } catch (error) {
    console.error("[TanaScore] getScore:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Recalcula e salva o score de um profissional
 */
exports.updateScore = async (req, res) => {
  try {
    const { profissionalId } = req.params;

    const resultado = await updateScore(profissionalId);

    return res.status(200).json({
      success: true,
      message: "TanaScore atualizado com sucesso.",
      data: resultado,
    });
  } catch (error) {
    console.error("[TanaScore] updateScore:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * Minha Evolução
 * Retorna todos os dados necessários para a tela
 */
exports.getMyEvolution = async (req, res) => {
  try {

    const profissional = await Profissional.findOne({
      userId: req.user._id,
    });

    if (!profissional) {
      return res.status(404).json({
        success: false,
        message: "Profissional não encontrado.",
      });
    }

    // Garante que o score esteja atualizado
    const resultado = await updateScore(profissional._id);

    const score = resultado.score;

    const currentLevel =
      LEVELS.find(
        l => score >= l.min && score <= l.max
      ) || LEVELS[0];

    const nextLevel =
      LEVELS.find(
        l => l.min > score
      ) || null;

    return res.json({
      success: true,

      data: {

        score,

        level: currentLevel,

        nextLevel: nextLevel
          ? {
              name: nextLevel.name,
              remaining:
                nextLevel.min - score,
            }
          : null,

        modules: resultado.modules,

searchScore: resultado.searchScore,

cityRanking: resultado.cityRanking,

professionRanking: resultado.professionRanking,

distanceLeader: resultado.distanceLeader,

seals: resultado.seals || [],

season: resultado.season || null,

reward: resultado.reward || null,

weeklyGain: 0,

tips: generateEvolutionTips(
  profissional,
  resultado.modules
),

achievements: [],

      },

    });

  } catch (e) {

    console.log(e);

    res.status(500).json({
      success: false,
      message: e.message,
    });

  }
};
/**
 * Recalcula o score de todos os profissionais
 * (uso administrativo)
 */
exports.updateAllScores = async (req, res) => {
  try {
    const resultado = await updateAllScores();

    return res.status(200).json({
      success: true,
      total: resultado.length,
      data: resultado,
    });
  } catch (error) {
    console.error("[TanaScore] updateAllScores:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};