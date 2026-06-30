/**
 * ============================================================
 * TanaScore™
 * Rule Engine
 * ------------------------------------------------------------
 * Executa qualquer conjunto de regras.
 *
 * Não conhece Mongo.
 * Não conhece Express.
 * Não conhece Mongoose.
 *
 * Apenas recebe dados.
 * ============================================================
 */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

/**
 * Executa um conjunto de regras.
 *
 * Cada regra possui:
 *
 * {
 *    weight:20,
 *    validate:(obj)=>true,
 *    message:"..."
 * }
 */

function executeRules(rules = [], data = {}) {

  let totalWeight = 0;
  let obtainedWeight = 0;

  const improvements = [];

  const details = [];

  for (const rule of rules) {

    const weight = Number(rule.weight || 0);

    totalWeight += weight;

    let approved = false;

    try {

      approved = !!rule.validate(data);

    } catch {

      approved = false;

    }

    details.push({

      key: rule.key,

      approved,

      weight

    });

    if (approved) {

      obtainedWeight += weight;

    } else {

      improvements.push(rule.message);

    }

  }

  const score =
    totalWeight === 0
      ? 0
      : clamp((obtainedWeight / totalWeight) * 100);

  return {

    score,

    improvements,

    details

  };

}

/**
 * Converte score para nível.
 */

function resolveLevel(score, levels = []) {

  for (const level of levels) {

    if (score >= level.min) {

      return level.name;

    }

  }

  return "Inicial";

}

/**
 * Junta listas removendo repetidos.
 */

function mergeImprovements(...lists) {

  const unique = new Set();

  lists.flat().forEach(item => {

    if (item)
      unique.add(item);

  });

  return [...unique];

}

module.exports = {

  executeRules,

  resolveLevel,

  mergeImprovements,

};