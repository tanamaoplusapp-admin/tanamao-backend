'use strict';

// Prova curta de integridade para pontos retornados pelo proprio backend
// (Places Details / Geocoding). Evita confirmar o mesmo ponto duas vezes
// via reverse geocode, que pode escolher a cidade do outro lado da fronteira.
// NAO e token de usuario e NAO substitui o JWT das rotas.
const crypto = require('node:crypto');
const TTL_MS = 30 * 60 * 1000;
const DOMAIN = 'tanamao-mobilidade-ponto-v1:';

function chave() {
  const valor = String(process.env.MOBILITY_DATA_KEY || '').trim();
  if (!/^[a-f\d]{64}$/i.test(valor)) {
    const err = new Error('A chave de protecao da Mobilidade nao esta configurada no servidor.');
    err.status = 503;
    throw err;
  }
  return Buffer.from(valor, 'hex');
}

function canonical(ponto) {
  const lat = Number(ponto?.lat ?? ponto?.latitude);
  const lng = Number(ponto?.lng ?? ponto?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('Coordenadas invalidas para validacao de ponto');
  }
  const campo = (valor, limite) => String(valor || '').trim().slice(0, limite);
  const pais = campo(ponto.pais || (String(ponto.uf || '').toUpperCase() === 'PY' ? 'PY' : 'BR'), 2).toUpperCase();
  return {
    lat: Math.round(lat * 1e6),
    lng: Math.round(lng * 1e6),
    endereco: campo(ponto.endereco, 240),
    cidade: campo(ponto.cidade, 80),
    uf: campo(ponto.uf, 2).toUpperCase(),
    pais,
    estado: campo(ponto.estado, 100),
  };
}

function assinatura(payload, segredo) {
  return crypto.createHmac('sha256', segredo).update(DOMAIN + payload).digest();
}

function assinarPonto(ponto, emitidoEm = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ v: 1, t: emitidoEm, p: canonical(ponto) })).toString('base64url');
  const mac = assinatura(payload, chave()).toString('base64url');
  return `${payload}.${mac}`;
}

function validarProva(ponto, prova, agora = Date.now()) {
  if (typeof prova !== 'string' || prova.length > 2000 || prova.length < 20) return false;
  const partes = prova.split('.');
  if (partes.length !== 2 || !partes.every(p => /^[\w-]+$/.test(p))) return false;
  try {
    const [payload, mac] = partes;
    const recebido = Buffer.from(mac, 'base64url');
    const esperado = assinatura(payload, chave());
    if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data?.v !== 1 || !Number.isSafeInteger(data?.t) || data.t > agora + 60000 || agora - data.t > TTL_MS) return false;
    return JSON.stringify(data.p) === JSON.stringify(canonical(ponto));
  } catch {
    return false;
  }
}

module.exports = { assinarPonto, validarProva, canonical };
