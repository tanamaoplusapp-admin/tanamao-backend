'use strict';

// Novo modulo opt-in: nao altera o cadastro tradicional ou o papel User.role.
const SERVICES = Object.freeze([
  'corrida_carro', 'corrida_moto', 'entrega_moto', 'entrega_carro',
  'frete_local', 'frete_intermunicipal', 'frete_interestadual', 'frete_internacional',
]);
const VEHICLES = Object.freeze(['moto', 'carro', 'utilitario', 'van', 'caminhao']);
const MODALITIES = Object.freeze(['corrida', 'entrega', 'frete']);
const enabled = () => process.env.MOBILITY_MODULE_ENABLED === 'true';
const approximateEnabled = () => process.env.MOBILITY_ALLOW_APPROXIMATE_ROUTES === 'true' &&
  (process.env.NODE_ENV !== 'production' || Boolean(String(process.env.MOBILITY_BETA_USER_IDS || '').trim()));
const betaAllowed = (userId, role) => {
  if(role === 'admin') return true;
  const ids = String(process.env.MOBILITY_BETA_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return !ids.length || ids.includes(String(userId || ''));
};
// A lista e OPERACIONAL e gerenciada apos a verificacao das autorizacoes locais.
// Nao equivale a consultar automaticamente legislacao: sem cadastro explicito, nega.
// Formatos compativeis: "Cidade,UF" (legado) ou "Cidade,UF,PAIS" (recomendado).
// Ex.: MUNICIPIO_VERIFICADO,UF,BR;CIUDAD_VERIFICADA,PY,PY (exemplos ilustrativos).
const normalizarCidade = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const normalizarSigla = value => String(value || '').trim().toUpperCase();
function motoPassengerAllowed(city, uf, pais) {
  if (process.env.MOBILITY_MOTO_PASSENGER_ENABLED !== 'true') return false;
  const nome = normalizarCidade(city), regiao = normalizarSigla(uf);
  const country = normalizarSigla(pais || (regiao === 'PY' ? 'PY' : 'BR'));
  if (!nome || !/^[A-Z]{2}$/.test(regiao) || !/^[A-Z]{2}$/.test(country)) return false;
  // Separacao por ; evita aceitar cidades por correspondencia parcial.
  return String(process.env.MOBILITY_MOTO_APPROVED_CITIES || '').split(';').some(item => {
    const partes = item.split(',').map(x => x.trim());
    if (partes.length !== 2 && partes.length !== 3) return false;
    const [cidadeLista, ufLista, paisLista] = partes;
    if (!cidadeLista || normalizarCidade(cidadeLista) !== nome) return false;
    if (normalizarSigla(ufLista) !== regiao) return false;
    const paisConfigurado = normalizarSigla(paisLista || (regiao === 'PY' ? 'PY' : 'BR'));
    return paisConfigurado === country;
  });
}
function politicaCorridaMoto(origem) {
  const cidade = String(origem?.cidade || '').trim();
  const uf = normalizarSigla(origem?.uf);
  const pais = normalizarSigla(origem?.pais || (uf === 'PY' ? 'PY' : 'BR'));
  const permitida = motoPassengerAllowed(cidade, uf, pais);
  const localidade = [cidade, uf && uf !== pais ? uf : null, pais].filter(Boolean).join(' - ');
  return {
    permitida,
    codigo: permitida ? 'AUTORIZADA' : 'NAO_HABILITADA',
    mensagem: permitida
      ? `A modalidade de passageiros por moto esta habilitada em ${localidade}.`
      : `Corridas de passageiros por moto ainda nao estao habilitadas em ${localidade || 'esta localidade'}. Voce pode pedir carro ou entrega por moto.`,
  };
}
const serviceVehicleCompatible = (service, type) => ({
  corrida_carro: ['carro'], corrida_moto: ['moto'],
  entrega_moto: ['moto'], entrega_carro: ['carro', 'utilitario', 'van'],
  frete_local: ['carro', 'utilitario', 'van', 'caminhao'],
  frete_intermunicipal: ['carro', 'utilitario', 'van', 'caminhao'],
  frete_interestadual: ['carro', 'utilitario', 'van', 'caminhao'],
  frete_internacional: ['carro', 'utilitario', 'van', 'caminhao'],
})[service]?.includes(type) || false;

module.exports = { SERVICES, VEHICLES, MODALITIES, enabled, approximateEnabled, betaAllowed, motoPassengerAllowed, politicaCorridaMoto, serviceVehicleCompatible };
