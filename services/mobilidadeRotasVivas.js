'use strict';
// Rota real a partir do GPS do motorista (sem expor a chave do Google ao app).
// Nao altera precos, status nem documentos; somente consulta a Routes API.
const axios = require('axios');
const mongoose = require('mongoose');
const Job = require('../models/MobilidadeSolicitacao');
const Profile = require('../models/MobilidadePerfil');
const R=require('./mobilidadeParadasRegras');

const cache = new Map();
const isValid = (x) => Number.isFinite(x) && Math.abs(x) <= 180;
const toPoint = (value) => {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude);
  return isValid(lat) && Math.abs(lat) <= 90 && isValid(lng) ? { lat, lng } : null;
};
const gpsPoint = (location) => Array.isArray(location?.coordinates)
  ? toPoint({lat: location.coordinates[1], lng: location.coordinates[0]}) : null;
const isSame = (a, b) => String(a || '') === String(b || '');
const cacheKey = (job, stage, from, to) => `${job._id}:${stage}:${from.lat.toFixed(4)}:${from.lng.toFixed(4)}:${to.lat.toFixed(4)}:${to.lng.toFixed(4)}`;
const seconds = (value) => Math.max(0, Number.parseFloat(String(value || 0)) || 0);

async function rotaViagem(req, res) {
  const userId = req.userId || req.user?._id;
  const jobId = String(req.params.jobId || '');
  if (!userId) return res.status(401).json({ok:false, erro:'Sessão inválida'});
  if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ok:false, erro:'Corrida inválida'});
  const job = await Job.findById(jobId).lean();
  if (!job) return res.status(404).json({ok:false, erro:'Corrida não encontrada'});
  if (!isSame(job.motoristaId, userId) && !isSame(job.clienteId, userId)) {
    return res.status(403).json({ok:false, erro:'Sem acesso a esta rota'});
  }
  if (!['aceita','no_local','em_andamento'].includes(job.status)) {
    return res.status(409).json({ok:false, disponivel:false, erro:'A viagem não está em deslocamento'});
  }
  const profile = await Profile.findOne({userId:job.motoristaId}).select('localizacao ultimaLocalizacaoEm').lean();
  const from = gpsPoint(profile?.localizacao);
  const to = toPoint(R.alvo(job));
  if (!from || !to) return res.status(200).json({ok:true, disponivel:false, motivo:'gps_indisponivel'});
  const age = Date.now() - new Date(profile?.ultimaLocalizacaoEm || 0).getTime();
  if (!Number.isFinite(age) || age > 180000 || age < -60000) {
    return res.status(200).json({ok:true, disponivel:false, motivo:'gps_desatualizado'});
  }
  const key = process.env.MOBILITY_GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) return res.status(503).json({ok:false, disponivel:false, erro:'Rota indisponível no momento'});
  const stage = job.status === 'em_andamento' ? (R.restante(job).length?'parada':'destino') : 'embarque';
  const id = cacheKey(job, `${stage}:${job.versaoRota||0}`, from, to);
  const cached = cache.get(id);
  if (cached && cached.until > Date.now()) return res.json(cached.value);
  try {
    const {data} = await axios.post('https://routes.googleapis.com/directions/v2:computeRoutes', {
      origin:{location:{latLng:{latitude:from.lat,longitude:from.lng}}},
      destination:{location:{latLng:{latitude:to.lat,longitude:to.lng}}},
      travelMode:'DRIVE', routingPreference:'TRAFFIC_AWARE',
      computeAlternativeRoutes:false, languageCode:'pt-BR', units:'METRIC',
    }, {timeout:8500,headers:{
      'Content-Type':'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    }});
    const route = data?.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return res.json({ok:true,disponivel:false,motivo:'rota_nao_encontrada'});
    const value = {
      ok:true, disponivel:true, etapa:stage, status:job.status,
      distanciaMetros:Math.round(Number(route.distanceMeters || 0)),
      duracaoMinutos:Math.max(1,Math.ceil(seconds(route.duration) / 60)),
      polyline:route.polyline.encodedPolyline,
      atualizadoEm:new Date().toISOString(),
      destino:to,
    };
    cache.set(id,{until:Date.now()+12000,value});
    if (cache.size > 600) for (const [k,v] of cache) if (v.until < Date.now()) cache.delete(k);
    res.set('Cache-Control','private, no-store');
    return res.json(value);
  } catch (e) {
    console.warn('[mobilidade/rota] Falha Google Routes:',e?.response?.status || e?.code || 'erro');
    return res.status(503).json({ok:false,disponivel:false,erro:'Rota indisponível. Abra o Google Maps para navegar.'});
  }
}
module.exports={rotaViagem,toPoint,gpsPoint};
