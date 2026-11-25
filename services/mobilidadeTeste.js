'use strict';
// Autorizacao de demonstracao entre duas contas identificadas. NUNCA substitui
// aprovacao documental, habilitacao legal ou permissao para viagens comerciais.
const Profile = require('../models/MobilidadePerfil');
const { serviceVehicleCompatible } = require('../config/mobilidade');
const ativo = () => process.env.MOBILITY_TEST_MODE_ENABLED === 'true';
const compara = (a, b) => !!a && !!b && String(a) === String(b);
const seguro = p => !!p && !['suspenso', 'reprovado'].includes(p.status);
function perfilEmTeste(p, agora = new Date()) {
  const r = p?.liberacaoTeste;
  return ativo() && seguro(p) && p.status === 'aprovado' && String(r?.veiculoId) === String(p.veiculoAtivoId) && !!r?.clienteTesteId && !!r?.veiculoId &&
    !r?.revogadaEm && !!r?.expiraEm && new Date(r.expiraEm).getTime() > agora.getTime() &&
    Array.isArray(r.servicos) && r.servicos.includes('corrida_carro');
}
function autorizadoPara(p, clienteId, servico, agora = new Date()) {
  return perfilEmTeste(p, agora) && compara(p.liberacaoTeste.clienteTesteId, clienteId) &&
    p.liberacaoTeste.servicos.includes(servico) && servico === 'corrida_carro';
}
function veiculoDemo(v, servico, passageiros = 1, tipoVeiculo = null) {
  return !!v && !['suspenso', 'reprovado'].includes(v.status) &&
    servico === 'corrida_carro' && serviceVehicleCompatible(servico, v.tipo) &&
    (!tipoVeiculo || v.tipo === tipoVeiculo) && Number(v.lugares) > Number(passageiros);
}
async function existeClienteComTeste(clienteId, servico, agora = new Date()) {
  if (!ativo() || servico !== 'corrida_carro') return false;
  const row = await Profile.exists({
    'liberacaoTeste.clienteTesteId': clienteId,
    'liberacaoTeste.expiraEm': { $gt: agora },
    'liberacaoTeste.revogadaEm': null,
    'liberacaoTeste.servicos': servico,
    status: { $nin: ['suspenso', 'reprovado'] },
  });
  return !!row;
}
module.exports = { ativo, perfilEmTeste, autorizadoPara, veiculoDemo, existeClienteComTeste };
