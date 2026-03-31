// utils/porteEmpresa.js
const config = require('../config/env');

// Fator por cidade/UF (permite override via .env PORTE_CITY_FACTORS_JSON)
function getCityFactor(cidade = '', uf = '') {
  try {
    if (config.porte && config.porte.cityFactorsJSON) {
      const map = JSON.parse(config.porte.cityFactorsJSON);
      const keyUF = (uf || '').toUpperCase();
      const keyCity = `${String(cidade || '').toLowerCase()}|${keyUF}`;
      if (map[keyCity] != null) return Number(map[keyCity]);
      if (map[keyUF] != null) return Number(map[keyUF]);
      if (map.default != null) return Number(map.default);
    }
  } catch (e) {
    console.warn('[porteEmpresa] cityFactorsJSON inválido:', e.message);
  }

  const expensiveUF = new Set(['SP', 'RJ', 'DF']);
  const cheapUF    = new Set(['AC','AL','AP','MA','PA','PI','RO','RR','TO']);
  const ufU = (uf || '').toUpperCase();
  if (expensiveUF.has(ufU)) return 1.10;
  if (cheapUF.has(ufU))     return 0.95;
  return 1.00;
}

/**
 * Avalia porte com base em:
 * - MEI declarado -> normaliza para 'pequena' (guardando original)
 * - faturamento anual ajustado pelo fator da cidade/UF
 * - capital social (se muito alto, pode subir 1 faixa)
 */
function assessPorteEmpresa({ declaradoPorte, faturamentoAnual, capitalSocial, cidade, uf }) {
  const meiMax     = Number(config.porte?.meiMax ?? 75000);
  const pequenaMax = Number(config.porte?.pequenaMax ?? 90000);
  const mediaMax   = Number(config.porte?.mediaMax ?? 190000);

  const f = Number(faturamentoAnual || 0);
  const cap = Number(capitalSocial || 0);

  if (String(declaradoPorte || '').trim().toLowerCase() === 'mei') {
    return {
      original: 'mei',
      normalizado: 'pequena',
      fonte: 'declarado',
      limites: { meiMax, pequenaMax, mediaMax },
      fatorCidade: getCityFactor(cidade, uf),
    };
  }

  const fatorCidade = getCityFactor(cidade, uf);
  const fAjustado = f / (fatorCidade || 1);

  let normalizado;
  if (fAjustado <= meiMax)        normalizado = 'pequena';
  else if (fAjustado <= pequenaMax) normalizado = 'pequena';
  else if (fAjustado <= mediaMax)   normalizado = 'media';
  else                               normalizado = 'grande';

  // Ajuste por capital social
  if (cap > 0 && f > 0) {
    const ratio = cap / f;
    if (ratio >= 0.6) {
      if (normalizado === 'pequena') normalizado = 'media';
      else if (normalizado === 'media') normalizado = 'grande';
    }
  }

  return {
    original: declaradoPorte ? String(declaradoPorte).toLowerCase() : null,
    normalizado,
    fonte: declaradoPorte ? 'declarado+calculado' : 'calculado',
    limites: { meiMax, pequenaMax, mediaMax },
    fatorCidade,
  };
}

module.exports = { assessPorteEmpresa, getCityFactor };
