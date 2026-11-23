'use strict';

// Endpoints autenticados de localizacao: Google Places (New) e Geocoding.
// A chave privada nunca e enviada ao aplicativo. Nao armazenamos as buscas.
const axios = require('axios');
const { randomUUID } = require('node:crypto');

const SESSION_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PLACE_RE = /^[A-Za-z0-9_.:-]{6,256}$/;
const PLACE_API = 'https://places.googleapis.com/v1';
const GEO_API = 'https://maps.googleapis.com/maps/api/geocode/json';

function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
function placesKey() {
  const key = process.env.MOBILITY_GOOGLE_PLACES_API_KEY || process.env.MOBILITY_GOOGLE_GEOCODING_API_KEY;
  if (!key) fail(503, 'Busca de lugares indisponivel. Configure MOBILITY_GOOGLE_PLACES_API_KEY no backend.');
  return key;
}
function geoKey() {
  const key = process.env.MOBILITY_GOOGLE_GEOCODING_API_KEY || process.env.MOBILITY_GOOGLE_PLACES_API_KEY;
  if (!key) fail(503, 'Selecao no mapa indisponivel. Configure MOBILITY_GOOGLE_GEOCODING_API_KEY no backend.');
  return key;
}
function session(raw) {
  if (typeof raw !== 'string' || !SESSION_RE.test(raw)) fail(400, 'Sessao de busca invalida. Abra a busca novamente.');
  return raw;
}
function pos(raw) {
  const lat = Number(raw?.lat ?? raw?.latitude);
  const lng = Number(raw?.lng ?? raw?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) fail(400, 'Ponto do mapa invalido.');
  return { lat, lng };
}
function component(components, type) {
  return (Array.isArray(components) ? components : []).find(c => Array.isArray(c.types) && c.types.includes(type));
}
function cityState(components) {
  const country = String(component(components, 'country')?.shortText || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) fail(422, 'Pais nao identificado. Ajuste o ponto no mapa e tente novamente.');
  const city = String(component(components, 'locality')?.longText ||
    component(components, 'postal_town')?.longText ||
    component(components, 'administrative_area_level_2')?.longText || '').trim();
  if (!city) fail(422, 'Cidade nao identificada. Escolha uma rua ou estabelecimento mais preciso.');
  const admin1 = component(components, 'administrative_area_level_1');
  const state = String(admin1?.longText || admin1?.shortText || '').trim();
  // The legacy app and tariff schemas use a two-letter 'uf' field. For
  // addresses outside Brazil we use the country code there (PY, AR, etc.)
  // while preserving the real region/department separately in 'estado'.
  const uf = country === 'BR' ? String(admin1?.shortText || '').trim().toUpperCase() : country;
  if (!/^[A-Z]{2}$/.test(uf)) fail(422, 'Estado nao identificado. Selecione um endereco mais preciso.');
  return { cidade: city, uf, pais: country, estado: state };
}
function parsePlace(data) {
  if (!data || !data.location) fail(502, 'O local escolhido nao tem coordenadas disponiveis.');
  const geo = pos({ lat: data.location.latitude, lng: data.location.longitude });
  const locale = cityState(data.addressComponents);
  const endereco = String(data.formattedAddress || data.displayName?.text || '').trim();
  if (!endereco) fail(502, 'O local escolhido nao possui endereco.');
  return { endereco, ...locale, ...geo };
}
function parseReverse(data) {
  if (data?.status !== 'OK' || !data.results?.length) fail(422, 'Nao foi possivel identificar o endereco nesse ponto do mapa.');
  const result = data.results.find(r => Array.isArray(r.types) && (r.types.includes('street_address') || r.types.includes('premise'))) ||
    data.results.find(r => Array.isArray(r.types) && r.types.includes('route')) || data.results[0];
  const components = (result.address_components || []).map(c => ({ types: c.types || [], longText: c.long_name, shortText: c.short_name }));
  const locale = cityState(components);
  const endereco = String(result.formatted_address || '').trim();
  if (!endereco) fail(422, 'Nao foi possivel identificar o endereco.');
  return { endereco, ...locale };
}
function googleError(e, label) {
  const status = Number(e?.response?.status || 0);
  const codigo = String(e?.response?.data?.error?.status || '');
  // Never log private API keys, full Google responses or user search text.
  console.warn('[mobilidade lugares] Google Maps request failed', { httpStatus: status || 'network', codigo });
  if (status === 403 || codigo === 'PERMISSION_DENIED') {
    fail(503, `${label}: o Google recusou a chave. Confira Places API (New), faturamento e restricoes da chave no Google Cloud.`);
  }
  if (status === 400 || codigo === 'INVALID_ARGUMENT') {
    fail(502, `${label}: a API Google rejeitou os parametros da consulta. Veja o log do backend.`);
  }
  if (status === 429 || codigo === 'RESOURCE_EXHAUSTED') {
    fail(503, 'Limite de consultas de enderecos atingido. Tente novamente mais tarde.');
  }
  if (status === 404) {
    fail(503, `${label}: a API Google nao foi encontrada. Confira se Places API (New) esta ativada.`);
  }
  fail(503, `${label} temporariamente indisponivel. Confira a conexao do backend com o Google Maps.`);
}
async function criarSessao(_req, res) {
  // Allows the app to report a missing key before the user starts typing.
  placesKey();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, sessao: randomUUID() });
}
async function sugestoes(req, res) {
  const texto = String(req.body?.texto || '').trim();
  if (texto.length < 3) return res.json({ ok: true, lugares: [] });
  if (texto.length > 120) fail(400, 'Busque com ate 120 caracteres.');
  const sessao = session(req.body?.sessao);
  // No country filter: near-border locations must return BR, PY and other countries.
  // locationBias favors nearby suggestions but never excludes distant addresses.
  const body = { input: texto, sessionToken: sessao, languageCode: 'pt-BR' };
  if (req.body?.latitude !== undefined && req.body?.longitude !== undefined) {
    const p = pos(req.body);
    body.locationBias = { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 30000 } };
  }
  let data;
  try {
    ({ data } = await axios.post(`${PLACE_API}/places:autocomplete`, body, {
      timeout: 8000,
      headers: { 'X-Goog-Api-Key': placesKey(), 'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text' },
    }));
  } catch (e) { if (e.status) throw e; googleError(e, 'Busca automatica de enderecos'); }
  const lugares = (data?.suggestions || []).flatMap(s => {
    const p = s.placePrediction;
    if (!p?.placeId || !PLACE_RE.test(p.placeId)) return [];
    return [{ id: p.placeId, titulo: p.structuredFormat?.mainText?.text || p.text?.text || 'Local',
      descricao: p.structuredFormat?.secondaryText?.text || p.text?.text || '' }];
  }).slice(0, 8);
  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, lugares, fonte: 'Google Places' });
}
async function detalhes(req, res) {
  const placeId = String(req.body?.placeId || '').trim();
  if (!PLACE_RE.test(placeId)) fail(400, 'Lugar selecionado invalido.');
  const sessao = session(req.body?.sessao);
  let data;
  try {
    ({ data } = await axios.get(`${PLACE_API}/places/${encodeURIComponent(placeId)}`, {
      timeout: 8000,
      params: { languageCode: 'pt-BR', sessionToken: sessao },
      headers: { 'X-Goog-Api-Key': placesKey(),
        'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents' },
    }));
  } catch (e) { if (e.status) throw e; googleError(e, 'Detalhes do endereco'); }
  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, ponto: parsePlace(data) });
}
async function reverso(req, res) {
  const p = pos(req.body);
  let data;
  try {
    ({ data } = await axios.get(GEO_API, { timeout: 8000,
      params: { latlng: `${p.lat},${p.lng}`, language: 'pt-BR', key: geoKey() } }));
  } catch (e) { if (e.status) throw e; googleError(e, 'Selecao no mapa'); }
  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, ponto: { ...parseReverse(data), ...p } });
}
module.exports = { criarSessao, sugestoes, detalhes, reverso, cityState, parsePlace, parseReverse, session, pos };
