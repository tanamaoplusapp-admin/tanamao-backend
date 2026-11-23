'use strict';
const Job = require('../models/MobilidadeSolicitacao');
const { id, error } = require('../middleware/mobilidade');
const { buscarElegiveis, LIMIT_KM } = require('./mobilidadeCandidatos');
const SEARCHING = new Set(['procurando', 'ofertada']);
const faixa = km => km == null ? null : km <= 3 ? 'ate_3_km' : km <= 8 ? 'entre_3_e_8_km' : km <= 15 ? 'entre_8_e_15_km' : 'mais_de_15_km';
function resumoSeguro(job, candidates) {
  const active = SEARCHING.has(job.status);
  const rows = active ? candidates : [];
  return {
    status: job.status,
    procurando: active,
    aguardandoResposta: job.status === 'ofertada',
    motoristasElegiveis: active ? rows.length : null,
    faixaMaisProxima: rows.length ? faixa(rows[0].km) : null,
    raioMaximoKm: active ? LIMIT_KM : null,
    atualizadoEm: new Date().toISOString(),
  };
}
async function buscar(req, res) {
  const job = await Job.findById(id(req.params.jobId)).lean();
  if (!job) error(404, 'Solicitacao nao encontrada');
  if (String(job.clienteId) !== String(req.userId || req.user?._id)) error(403, 'Sem acesso a esta solicitacao');
  const candidates = SEARCHING.has(job.status) ? await buscarElegiveis(job) : [];
  res.set('Cache-Control', 'private, no-store');
  return res.json({ ok: true, busca: resumoSeguro(job, candidates) });
}
module.exports = { buscar, resumoSeguro, faixa };
