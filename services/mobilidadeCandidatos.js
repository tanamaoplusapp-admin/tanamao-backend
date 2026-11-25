'use strict';
// One shared eligibility query for real dispatch and the passenger's aggregate search status.
// Never return individual candidate coordinates or IDs to a passenger.
const Teste = require('./mobilidadeTeste');
const trust = require('mongoose').trusted;
const Profile = require('../models/MobilidadePerfil');
const Profissional = require('../models/Profissional');
const Pagamento = require('./mobilidadePagamento');
const { possuiProfissaoMotorista } = require('./mobilidadeProfissao');
const { compativel } = require('./mobilidadePreferencias');
const { betaAllowed, serviceVehicleCompatible } = require('../config/mobilidade');
const User = require('../models/user');
const { fotoAprovada } = require('./mobilidadeFoto');
const Vehicle = require('../models/MobilidadeVeiculo');
const { kilometers, validCnh, validVehicle, cnhSupportsVehicle } = require('./mobilidadeCalculo');
const PoliticaMoto = require('./mobilidadePoliticaMoto');
const {veiculoComfort}=require('./mobilidadeComfort');
const LIMIT_KM = Math.min(100, Math.max(1, Number(process.env.MOBILITY_MAX_PICKUP_KM) || 25));
// Diagnóstico agregado, opcional, sem dados do passageiro, placa ou GPS.
const diagnostico = (fase, quantidade) => {
  if (process.env.MOBILITY_DISPATCH_DEBUG === 'true') {
    console.info('[mobilidade/elegibilidade]', fase, 'contagem=', quantidade);
  }
};

// A liberação manual pertence exclusivamente ao perfil aprovado no painel.
// Sem liberação manual, permanece a validação documental normal.
function documentosAutorizados(perfil, usuario) {
  return perfil.liberacaoManual === true || (fotoAprovada(perfil, usuario) && validCnh(perfil));
}

function veiculoCompativel(perfil, veiculo, solicitacao) {
  if (!veiculo || String(veiculo.userId) !== String(perfil.userId)) return false;
  if(solicitacao.categoriaCorrida==='comfort'&&!veiculoComfort(veiculo))return false;
  if (perfil.liberacaoManual !== true) {
    if (!veiculo.placaConferidaEm) return false; // Aprovacao manual de foto frontal/placa e CRLV.
    return cnhSupportsVehicle(perfil.cnh?.categoria, veiculo.tipo) &&
      validVehicle(veiculo, solicitacao.servico, solicitacao.passageiros, solicitacao.carga, solicitacao.tipoVeiculo);
  }
  // O cadastro pendente pode ser testado somente quando liberado pelo administrador.
  // Nunca aceita veículo suspenso/reprovado nem incompatível com a solicitação.
  if (['suspenso', 'reprovado'].includes(veiculo.status)) return false;
  if (!serviceVehicleCompatible(solicitacao.servico, veiculo.tipo)) return false;
  if (solicitacao.tipoVeiculo && veiculo.tipo !== solicitacao.tipoVeiculo) return false;
  if (solicitacao.servico.startsWith('corrida') && Number(veiculo.lugares || 0) <= Number(solicitacao.passageiros || 1)) return false;
  if (solicitacao.carga?.pesoKg && Number(veiculo.capacidadeKg || 0) < Number(solicitacao.carga.pesoKg)) return false;
  if (solicitacao.carga?.volumeM3 && Number(veiculo.capacidadeM3 || 0) < Number(solicitacao.carga.volumeM3)) return false;
  if (['frete_interestadual', 'frete_internacional'].includes(solicitacao.servico) && !veiculo.rntrc) return false;
  return true;
}

async function buscarElegiveis(job) {
  if (!job || !job.origem || !Number.isFinite(Number(job.origem.lat)) || !Number.isFinite(Number(job.origem.lng))) return [];
  if (!betaAllowed(job.clienteId)) return [];
  if (job.servico === 'corrida_moto' && !(await PoliticaMoto.consultar(job.origem)).permitida) return [];
  const cutoff = new Date(Date.now() - 120000);
  const profiles = await Profile.find({
    status: 'aprovado', servicosAprovados: job.servico, online: true, emViagemId: null,
    servicosAtivos: job.servico,
    ...((job.paradas||[]).length?{suportaParadasEm:trust({$gte:cutoff})}:{}),
    ultimaLocalizacaoEm: trust({ $gte: cutoff }),
    userId: trust({ $nin: job.ignorados || [] }),
    localizacao: trust({ $near: { $geometry: {
      type: 'Point', coordinates: [Number(job.origem.lng), Number(job.origem.lat)],
    }, $maxDistance: LIMIT_KM * 1000 } }),
  }).limit(200).lean();
  diagnostico('perfis_online_proximos_com_gps_recente', profiles.length);
  if (!profiles.length) return [];
  const forma = Pagamento.validarForma(job.pagamento?.metodo);
  const [professionals, users] = await Promise.all([
    Profissional.find({
      _id: trust({ $in: profiles.map(p => p.profissionalId) }),
      [Pagamento.CAMPOS[forma]]: true,
    }).select('_id profissaoNome profissoes profissoesDetalhadas').lean(),
    User.find({
      _id: trust({ $in: profiles.map(p => p.userId) }),
      status: trust({ $nin: ['blocked','bloqueado','suspended','inactive'] }),
    }).select('_id genero preferenciaAtendimento avatar acessoExpiraEm subscriptionStatus').lean(),
  ]);
  const permitted = new Set(professionals.filter(possuiProfissaoMotorista).map(p => String(p._id)));
  diagnostico('prestadores_aceitam_pagamento_e_sao_motoristas', permitted.size);
  diagnostico('contas_com_acesso_ativo', users.length);
  const userById = new Map(users.map(u => [String(u._id), u]));
  const clienteTeste=await Teste.existeClienteComTeste(job.clienteId,job.servico);
  const eligibleProfiles = profiles.filter(p => {
    const reservado=!!p.liberacaoTeste?.clienteTesteId || p.liberacaoTeste?.somenteOnline === true;
    p.liberacaoManual=Teste.autorizadoPara(p,job.clienteId,job.servico);
    if ((reservado && !p.liberacaoManual) || (clienteTeste && !p.liberacaoManual)) return false;
    const account = userById.get(String(p.userId));
    return betaAllowed(p.userId) && permitted.has(String(p.profissionalId)) &&
      account && (p.liberacaoManual || (account.acessoExpiraEm && new Date(account.acessoExpiraEm)>new Date() && !['overdue','blocked'].includes(account.subscriptionStatus))) && documentosAutorizados(p, account) && compativel(job, account) &&
      Array.isArray(p.localizacao?.coordinates) &&
      p.localizacao.coordinates.length === 2;
  });
  diagnostico('perfis_apos_documentos_e_preferencias', eligibleProfiles.length);
  if (!eligibleProfiles.length) return [];
  const vehicleIds = eligibleProfiles.map(p => p.veiculoAtivoId).filter(Boolean);
  if (!vehicleIds.length) return [];
  const vehicles = await Vehicle.find({ _id: trust({ $in: vehicleIds }) }).lean();
  const vehicleById = new Map(vehicles.map(v => [String(v._id), v]));
  const result = [];
  for (const p of eligibleProfiles) {
    const vehicle = vehicleById.get(String(p.veiculoAtivoId || ''));
    if (!veiculoCompativel(p, vehicle, job)) continue;
    const km = kilometers({ lat: p.localizacao.coordinates[1], lng: p.localizacao.coordinates[0] }, job.origem);
    if (!Number.isFinite(km) || km > LIMIT_KM) continue;
    result.push({ p, vehicle, km });
  }
  diagnostico('motoristas_aptos_a_receber_oferta', result.length);
  return result.sort((a, b) => a.km - b.km);
}
module.exports = { buscarElegiveis, LIMIT_KM, documentosAutorizados, veiculoCompativel };
