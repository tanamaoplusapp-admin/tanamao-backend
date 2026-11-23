'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load(rel, mocks) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  const module = { exports: {} };
  const wrapped = vm.runInThisContext('(function(require,module,exports,process){' + code + '\n})', { filename: rel });
  wrapped(name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    throw Error('Mock not supplied: ' + name);
  }, module, module.exports, process);
  return module.exports;
}
function chain(value) {
  return { limit() { return this; }, select() { return this; }, sort() { return this; }, lean: async () => value };
}
const p1 = { _id: 'profile1', userId: 'u1', profissionalId: 'pr1', veiculoAtivoId: 'v1',
  cnh: { status: 'aprovado', categoria: 'B' }, localizacao: { coordinates: [-55.73, -22.54] } };
const p2 = { ...p1, _id: 'profile2', userId: 'u2', profissionalId: 'pr2', veiculoAtivoId: 'v2' };
const candidateMocks = {
  mongoose: { trusted: x => x },
  '../models/MobilidadePerfil': { find: () => chain([p1, p2]) },
  '../models/Profissional': { find: () => chain([{ _id: 'pr1' }, { _id: 'pr2' }]) },
  '../models/user': { find: () => chain([{ _id: 'u1', genero: 'feminino' }, { _id: 'u2', genero: 'masculino' }]) },
  '../models/MobilidadeVeiculo': { find: () => chain([{ _id: 'v1', userId: 'u1', tipo: 'carro', status: 'aprovado' },
    { _id: 'v2', userId: 'u2', tipo: 'carro', status: 'aprovado' }]) },
  './mobilidadePagamento': { validarForma: x => x, CAMPOS: { pix: 'aceitaPix' } },
  './mobilidadeProfissao': { possuiProfissaoMotorista: () => true },
  './mobilidadePreferencias': { compativel: (job, user) => user.genero === 'feminino' },
  '../config/mobilidade': { betaAllowed: () => true },
  './mobilidadeFoto': { fotoAprovada: () => true },
  './mobilidadeCalculo': { kilometers: () => 2.4, validCnh: () => true, validVehicle: () => true,
    cnhSupportsVehicle: () => true },
  './mobilidadePoliticaMoto': {consultar: async () => ({permitida:false})},
};
const candidates = load('services/mobilidadeCandidatos.js', candidateMocks);
const job = { clienteId: 'customer1', origem: { lat: -22.54, lng: -55.72 },
  servico: 'corrida_carro', tipoVeiculo: 'carro', passageiros: 1, pagamento: { metodo: 'pix' }, ignorados: [] };

test('only compatible approved drivers are candidates', async () => {
  const result = await candidates.buscarElegiveis(job);
  assert.equal(result.length, 1);
  assert.equal(result[0].p.userId, 'u1');
  assert.equal(result[0].vehicle.tipo, 'carro');
  assert.equal(result[0].km, 2.4);
});

test('invalid pickup coordinates never query driver profiles', async () => {
  assert.deepEqual(await candidates.buscarElegiveis({ ...job, origem: { lat: 'invalid', lng: -55.72 } }), []);
});

const searchMocks = {
  '../models/MobilidadeSolicitacao': { findById: () => ({ lean: async () => ({ ...job, status: 'procurando' }) }) },
  '../middleware/mobilidade': { id: x => x, error: (status, message) => { throw Object.assign(new Error(message), { status }); } },
  './mobilidadeCandidatos': { buscarElegiveis: async () => [{ km: 1.5, p: p1, vehicle: { placa: 'SECRET' } }], LIMIT_KM: 25 },
};
const search = load('services/mobilidadeBuscaCliente.js', searchMocks);

test('aggregate never exposes motorist IDs, GPS or plate', () => {
  const output = search.resumoSeguro({ status: 'procurando' }, [{ km: 1.5, p: p1, vehicle: { placa: 'SECRET' } }]);
  assert.equal(output.motoristasElegiveis, 1);
  assert.equal(output.faixaMaisProxima, 'ate_3_km');
  const json = JSON.stringify(output);
  for (const value of ['u1', 'v1', 'profile1', 'SECRET', '-55.73']) assert.equal(json.includes(value), false);
});

test('search stops counting drivers when a trip has been completed', () => {
  const output = search.resumoSeguro({ status: 'concluida' }, [{ km: 1.5 }]);
  assert.equal(output.procurando, false);
  assert.equal(output.motoristasElegiveis, null);
});

test('search status is only accessible to the customer', async () => {
  const response = { set() { return this; }, json(body) { this.body = body; return this; } };
  await assert.rejects(search.buscar({ userId: 'unauthorized', params: { jobId: 'j1' } }, response), { status: 403 });
  await search.buscar({ userId: 'customer1', params: { jobId: 'j1' } }, response);
  assert.equal(response.body.busca.motoristasElegiveis, 1);
  assert.equal(response.body.busca.faixaMaisProxima, 'ate_3_km');
});

test('route uses existing auth and the new availability endpoint', () => {
  const routes = fs.readFileSync(path.join(root, 'routes/mobilidadeRoutes.js'), 'utf8');
  assert.match(routes, /router\.use\(guardEnabled,verifyToken,betaGuard\)/);
  assert.match(routes, /cliente\/solicitacoes\/:jobId\/busca/);
  assert.match(routes, /buscaCliente\.buscar/);
});

test('aggregate checks payment, approval, subscription, preferences and vehicle', () => {
  const lookup = fs.readFileSync(path.join(root, 'services/mobilidadeCandidatos.js'), 'utf8');
  for (const term of ['CAMPOS[forma]', 'acessoExpiraEm', 'fotoAprovada', 'compativel', 'validCnh', 'validVehicle', 'PoliticaMoto']) {
    assert.ok(lookup.includes(term), 'Missing eligibility filter: ' + term);
  }
});
