'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load(relative, mocks) {
  const code = fs.readFileSync(path.join(root, relative), 'utf8');
  const mod = { exports: {} };
  const wrapped = vm.runInThisContext('(function(require,module,exports,process){' + code + '\n})', { filename: relative });
  wrapped(name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    throw new Error('Mock ausente: ' + name);
  }, mod, mod.exports, process);
  return mod.exports;
}
const chain = value => ({ limit() { return this; }, select() { return this; }, sort() { return this; }, lean: async () => value });
const baseProfile = {
  _id: 'p1', profissionalId: 'prof1', userId: 'driver1', status: 'aprovado',
  online: true, servicosAprovados: ['corrida_carro'], servicosAtivos: ['corrida_carro'],
  veiculoAtivoId: 'car1', localizacao: { coordinates: [-55.72, -22.54] },
  cnh: { status: 'pendente', categoria: 'B' }, liberacaoManual: true,
};
const passengerJob = {
  _id: 'j1', clienteId: 'client1', origem: { lat: -22.54, lng: -55.72 },
  destino: { lat: -22.55, lng: -55.71 }, tipoVeiculo: 'carro', servico: 'corrida_carro',
  passageiros: 1, carga: {}, pagamento: { metodo: 'pix' }, ignorados: [],
};
function candidateSetup({ profile = baseProfile, payment = true, vehicleStatus = 'pendente', seats = 4 } = {}) {
  const queries = [];
  const mocks = {
    mongoose: { trusted: x => x },
    '../models/MobilidadePerfil': { find: query => { queries.push(query); return chain([profile]); } },
    '../models/Profissional': { find: q => chain(payment ? [{ _id: 'prof1' }] : []) },
    '../models/user': { find: q => chain([{ _id: 'driver1', genero: 'masculino' }]) },
    '../models/MobilidadeVeiculo': { find: q => chain([{ _id: 'car1', userId: 'driver1', tipo: 'carro', status: vehicleStatus, lugares: seats }]) },
    './mobilidadePagamento': { validarForma: () => 'pix', CAMPOS: { pix: 'aceitaPix' } },
    './mobilidadeProfissao': { possuiProfissaoMotorista: () => true },
    './mobilidadePreferencias': { compativel: () => true },
    '../config/mobilidade': { betaAllowed: () => true, serviceVehicleCompatible: (s, t) => s === 'corrida_carro' && t === 'carro' },
    './mobilidadeFoto': { fotoAprovada: () => false },
    './mobilidadeCalculo': { kilometers: () => 2.4, validCnh: () => false, validVehicle: () => false, cnhSupportsVehicle: () => true },
    './mobilidadePoliticaMoto': { consultar: async () => ({ permitida: true }) },
  };
  return { candidates: load('services/mobilidadeCandidatos.js', mocks), queries };
}
test('perfil liberado manualmente recebe oferta mesmo com documentos pendentes', async () => {
  const { candidates, queries } = candidateSetup();
  const result = await candidates.buscarElegiveis(passengerJob);
  assert.equal(result.length, 1);
  assert.equal(result[0].p.userId, 'driver1');
  assert.equal(result[0].vehicle.tipo, 'carro');
  assert.equal(result[0].km, 2.4);
  assert.ok(queries[0].ultimaLocalizacaoEm.$gte instanceof Date, 'exige GPS recente');
  assert.equal(queries[0].online, true);
});
test('motorista SEM liberacao manual continua exigindo documentos aprovados', async () => {
  const { candidates } = candidateSetup({ profile: { ...baseProfile, liberacaoManual: false } });
  assert.equal((await candidates.buscarElegiveis(passengerJob)).length, 0);
});
test('liberacao manual nunca inclui veiculo suspenso nem sem vagas', async () => {
  const suspended = candidateSetup({ vehicleStatus: 'suspenso' });
  assert.equal((await suspended.candidates.buscarElegiveis(passengerJob)).length, 0);
  const noSeats = candidateSetup({ seats: 1 });
  assert.equal((await noSeats.candidates.buscarElegiveis(passengerJob)).length, 0);
});
test('liberacao manual nao altera a necessidade de aceitar a forma de pagamento', async () => {
  const { candidates } = candidateSetup({ payment: false });
  assert.equal((await candidates.buscarElegiveis(passengerJob)).length, 0);
});
test('despacho compartilha a busca e envia oferta ao perfil elegivel', async () => {
  const emitted = [], saved = [], push = [];
  const updated = { ofertaExpiraEm: new Date(Date.now() + 25000) };
  const dispatcher = load('services/mobilidadeDespacho.js', {
    mongoose: { trusted: x => x },
    '../models/MobilidadeSolicitacao': {
      findById: () => ({ lean: async () => ({ ...passengerJob, status: 'procurando', tentativas: 0, valorCentavos: 1872 }) }),
      findOneAndUpdate: async (q, change) => { saved.push(change); return updated; },
    },
    './mobilidadeCandidatos': { buscarElegiveis: async () => [{ p: baseProfile, vehicle: { _id: 'car1' }, km: 2.4 }] },
    './mobilidadePoliticaMoto': {},
    './mobilidadeSocket': { emit: (...args) => emitted.push(args) },
    './pushService': { enviarPushParaUsuario: async (...args) => { push.push(args); } },
  });
  const response = await dispatcher.dispatchOne({}, 'j1');
  assert.ok(response);
  assert.equal(saved[0].$set.status, 'ofertada');
  assert.ok(emitted.some(x => x[1] === 'driver1' && x[2] === 'oferta:nova'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(push.length, 1);
  assert.equal(push[0][1].type, 'MOBILIDADE_OFERTA');
});
