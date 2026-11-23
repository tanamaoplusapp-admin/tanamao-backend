'use strict';
// One shared eligibility query for real dispatch and the passenger's aggregate search status.
// Never return individual candidate coordinates or IDs to a passenger.
const trust = require('mongoose').trusted;
const Profile = require('../models/MobilidadePerfil');
const Profissional = require('../models/Profissional');
const Pagamento = require('./mobilidadePagamento');
const { possuiProfissaoMotorista } = require('./mobilidadeProfissao');
const { compativel } = require('./mobilidadePreferencias');
const { betaAllowed } = require('../config/mobilidade');
const User = require('../models/user');
const { fotoAprovada } = require('./mobilidadeFoto');
const Vehicle = require('../models/MobilidadeVeiculo');
const { kilometers, validCnh, validVehicle, cnhSupportsVehicle } = require('./mobilidadeCalculo');
const PoliticaMoto = require('./mobilidadePoliticaMoto');
const LIMIT_KM = Math.min(100, Math.max(1, Number(process.env.MOBILITY_MAX_PICKUP_KM) || 25));

async function buscarElegiveis(job) {
  if (!job || !job.origem || !Number.isFinite(Number(job.origem.lat)) || !Number.isFinite(Number(job.origem.lng))) return [];
  if (!betaAllowed(job.clienteId)) return [];
  if (job.servico === 'corrida_moto' && !(await PoliticaMoto.consultar(job.origem)).permitida) return [];
  const cutoff = new Date(Date.now() - 120000);
  const profiles = await Profile.find({
    status: 'aprovado', online: true, emViagemId: null,
    servicosAprovados: job.servico, servicosAtivos: job.servico,
    ultimaLocalizacaoEm: trust({ $gte: cutoff }),
    userId: trust({ $nin: job.ignorados || [] }),
    localizacao: trust({ $near: { $geometry: {
      type: 'Point', coordinates: [Number(job.origem.lng), Number(job.origem.lat)],
    }, $maxDistance: LIMIT_KM * 1000 } }),
  }).limit(200).lean();
  if (!profiles.length) return [];
  const forma = Pagamento.validarForma(job.pagamento?.metodo);
  const [professionals, users] = await Promise.all([
    Profissional.find({
      _id: trust({ $in: profiles.map(p => p.profissionalId) }),
      [Pagamento.CAMPOS[forma]]: true,
    }).select('_id profissaoNome profissoes profissoesDetalhadas').lean(),
    User.find({
      _id: trust({ $in: profiles.map(p => p.userId) }),
      acessoExpiraEm: trust({ $gt: new Date() }),
      status: trust({ $ne: 'blocked' }),
      subscriptionStatus: trust({ $nin: ['overdue', 'blocked'] }),
    }).select('_id genero preferenciaAtendimento avatar').lean(),
  ]);
  const permitted = new Set(professionals.filter(possuiProfissaoMotorista).map(p => String(p._id)));
  const userById = new Map(users.map(u => [String(u._id), u]));
  const eligibleProfiles = profiles.filter(p => {
    const account = userById.get(String(p.userId));
    return betaAllowed(p.userId) && permitted.has(String(p.profissionalId)) &&
      account && fotoAprovada(p, account) && compativel(job, account) &&
      validCnh(p) && Array.isArray(p.localizacao?.coordinates) &&
      p.localizacao.coordinates.length === 2;
  });
  if (!eligibleProfiles.length) return [];
  const vehicleIds = eligibleProfiles.map(p => p.veiculoAtivoId).filter(Boolean);
  if (!vehicleIds.length) return [];
  const vehicles = await Vehicle.find({ _id: trust({ $in: vehicleIds }) }).lean();
  const vehicleById = new Map(vehicles.map(v => [String(v._id), v]));
  const result = [];
  for (const p of eligibleProfiles) {
    const vehicle = vehicleById.get(String(p.veiculoAtivoId || ''));
    if (!vehicle || String(vehicle.userId) !== String(p.userId)) continue;
    if (!cnhSupportsVehicle(p.cnh?.categoria, vehicle.tipo) ||
        !validVehicle(vehicle, job.servico, job.passageiros, job.carga, job.tipoVeiculo)) continue;
    const km = kilometers({ lat: p.localizacao.coordinates[1], lng: p.localizacao.coordinates[0] }, job.origem);
    if (!Number.isFinite(km) || km > LIMIT_KM) continue;
    result.push({ p, vehicle, km });
  }
  return result.sort((a, b) => a.km - b.km);
}
module.exports = { buscarElegiveis, LIMIT_KM };
