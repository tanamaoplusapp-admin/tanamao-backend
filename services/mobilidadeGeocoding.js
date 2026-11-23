'use strict';

// Comprova se as coordenadas/cidade/pais do trajeto conferem com o Google.
// Quando o ponto foi retornado pelo nosso proprio backend, sua assinatura
// comprova a integridade. Nao e necessario geocodificar uma segunda vez:
// na fronteira seca o Google pode identificar a cidade vizinha na consulta
// reversa, apesar de Places Details ter fornecido um endereco correto.
const axios = require('axios');
const { approximateEnabled } = require('../config/mobilidade');
const { validarProva } = require('./mobilidadePontoVerificado');
function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
const normalize = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const field = (parts, kind) => parts.find(c => Array.isArray(c.types) && c.types.includes(kind));

function resultadoConfere(ponto, result) {
  const parts = Array.isArray(result?.address_components) ? result.address_components : [];
  const country = String(field(parts, 'country')?.short_name || '').toUpperCase();
  const estado = String(field(parts, 'administrative_area_level_1')?.short_name || '').toUpperCase();
  const cidades = ['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_3']
    .map(tipo => field(parts, tipo)?.long_name).filter(Boolean);
  const paisDeclarado = String(ponto.pais || (ponto.uf === 'PY' ? 'PY' : 'BR')).toUpperCase();
  if (!country || country !== paisDeclarado) return false;
  if (country === 'BR' && estado !== String(ponto.uf || '').toUpperCase()) return false;
  if (country !== 'BR' && String(ponto.uf || '').toUpperCase() !== country) return false;
  return cidades.some(nome => normalize(nome) === normalize(ponto.cidade));
}

async function validarLocalidade(ponto, validacao) {
  // A comprovacao e assinada pelo backend; editar uma coordenada, cidade,
  // pais ou endereco apos selecionar o Google invalida a assinatura.
  if (validarProva(ponto, validacao)) return ponto;
  if (approximateEnabled()) return ponto; // Apenas testes nao comerciais.
  const key = process.env.MOBILITY_GOOGLE_GEOCODING_API_KEY || process.env.MOBILITY_GOOGLE_ROUTES_API_KEY;
  if (!key) fail(503, 'Verificacao de cidades indisponivel. Configure Geocoding API para rotas reais');
  let data;
  try {
    ({data} = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      timeout: 7000, params: { latlng: `${ponto.lat},${ponto.lng}`, key, language: 'pt-BR' },
    }));
  } catch {
    fail(503, 'Nao foi possivel verificar a localidade do trajeto');
  }
  if (data?.status !== 'OK' || !Array.isArray(data.results) || !data.results.length) {
    fail(503, 'Geocoding retornou localidade indisponivel');
  }
  // Nao usar somente o primeiro resultado: perto da fronteira podem vir
  // resultados de cidades/administracoes diferentes para o mesmo ponto.
  if (!data.results.some(r => resultadoConfere(ponto, r))) {
    fail(400, 'Pais ou cidade nao conferem com as coordenadas. Selecione novamente o endereco');
  }
  return ponto;
}
module.exports = { validarLocalidade, resultadoConfere };
