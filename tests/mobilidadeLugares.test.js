'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(axiosStub = {}, env = { MOBILITY_GOOGLE_PLACES_API_KEY: 'CHAVE_TESTE' }) {
  const filename = path.resolve(__dirname, '../services/mobilidadeLugares.js');
  const code = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const localRequire = id => id === 'axios' ? axiosStub : require(id);
  vm.runInNewContext('(function (require, module, exports, process) { ' + code + '\n })', {}, { filename })(localRequire, module, module.exports, { env });
  return module.exports;
}
function response() {
  const payload = { data: null, headers: {} };
  return { data: payload,
    res: { set(key, val) { payload.headers[key] = val; return this; }, json(data) { payload.data = data; return this; } } };
}
const components = [
  { types: ['locality'], longText: 'Ponta Porã', shortText: 'Ponta Porã' },
  { types: ['administrative_area_level_1'], longText: 'Mato Grosso do Sul', shortText: 'MS' },
  { types: ['country'], longText: 'Brasil', shortText: 'BR' },
];
const session = 'f8b0c5af-3e96-4ef2-95b1-45a874279047';

test('detalhe de um local retorna endereco, municipio, UF e coordenadas', () => {
  const api = load();
  assert.deepEqual({ ...api.parsePlace({ formattedAddress: 'Rua Tiradentes, 90, Ponta Porã - MS',
    addressComponents: components, location: { latitude: -22.536, longitude: -55.725 } }) },
    { endereco: 'Rua Tiradentes, 90, Ponta Porã - MS', cidade: 'Ponta Porã', uf: 'MS', pais: 'BR', estado: 'Mato Grosso do Sul', lat: -22.536, lng: -55.725 });
});

test('autocompletar normaliza a resposta Google sem expor a chave', async () => {
  let called = false;
  const api = load({ post: async (url, body, config) => {
    called = true;
    assert.match(url, /places:autocomplete$/);
    assert.equal(body.input, 'Rua Tiradentes');
    assert.equal(body.sessionToken, session);
    assert.equal(body.locationBias.circle.center.latitude, -22.536);
    assert.equal(config.headers['X-Goog-Api-Key'], 'CHAVE_TESTE');
    return { data: { suggestions: [{ placePrediction: { placeId: 'ChIJabcDEFghklm', text: { text: 'Rua Tiradentes, Ponta Porã' },
      structuredFormat: { mainText: { text: 'Rua Tiradentes' }, secondaryText: { text: 'Ponta Porã, MS' } } } }] } };
  } });
  const { res, data } = response();
  await api.sugestoes({ body: { texto: 'Rua Tiradentes', sessao: session, latitude: -22.536, longitude: -55.72 } }, res);
  assert.equal(called, true);
  assert.equal(data.data.lugares.length, 1);
  assert.equal(data.data.lugares[0].titulo, 'Rua Tiradentes');
  assert.equal(JSON.stringify(data.data).includes('CHAVE_TESTE'), false);
});

test('detalhes de sugestao usam mesmo token e devolvem ponto', async () => {
  const api = load({ get: async (url, config) => {
    assert.match(url, /places\/ChIJabcDEFghklm$/);
    assert.equal(config.params.sessionToken, session);
    return { data: { formattedAddress: 'Rua Tiradentes, Ponta Porã - MS', addressComponents: components,
      location: { latitude: -22.536, longitude: -55.725 } } };
  } });
  const { res, data } = response();
  await api.detalhes({ body: { placeId: 'ChIJabcDEFghklm', sessao: session } }, res);
  assert.equal(data.data.ponto.uf, 'MS');
  assert.equal(data.data.ponto.cidade, 'Ponta Porã');
});

test('selecionar no mapa transforma coordenada em cidade validada', async () => {
  const api = load({ get: async (_url, _config) => ({ data: { status: 'OK', results: [{
    types: ['street_address'], formatted_address: 'Rua Tiradentes, Ponta Porã, MS',
    address_components: components.map(c => ({ types: c.types, long_name: c.longText, short_name: c.shortText })),
  }] } }) });
  const { res, data } = response();
  await api.reverso({ body: { lat: -22.536, lng: -55.725 } }, res);
  assert.equal(data.data.ponto.uf, 'MS');
  assert.equal(data.data.ponto.lat, -22.536);
});

test('rejeita sessao, coordenada, pais e placeId invalidos', async () => {
  const api = load();
  assert.throws(() => api.session('token'), /Sessao de busca invalida/);
  assert.throws(() => api.pos({ lat: 200, lng: 10 }), /Ponto do mapa invalido/);
  assert.throws(() => api.cityState([{ types: ['country'], shortText: 'PY' }]), /Cidade nao identificada/);
  await assert.rejects(() => api.detalhes({ body: { placeId: 'http://localhost', sessao: session } }, response().res), /Lugar selecionado invalido/);
});

test('configuracao de API ausente gera erro explicito e nao busca na internet', async () => {
  const api = load({ post: () => { throw new Error('Nao deve chamar Google'); } }, {});
  await assert.rejects(() => api.sugestoes({ body: { texto: 'Ponta Pora', sessao: session } }, response().res), /MOBILITY_GOOGLE_PLACES_API_KEY/);
});


test('sessao verifica se chave Google existe antes da primeira busca', async () => {
  const api = load({}, {});
  await assert.rejects(() => api.criarSessao({}, response().res), /MOBILITY_GOOGLE_PLACES_API_KEY/);
});

test('falha Google 403 descreve que chave, API ou billing devem ser verificados', async () => {
  const api = load({ post: async () => { const error = new Error('403'); error.response = { status: 403, data: { error: { status: 'PERMISSION_DENIED' } } }; throw error; } });
  await assert.rejects(() => api.sugestoes({ body: { texto: 'Rua Tiradentes', sessao: session } }, response().res), /faturamento e restricoes da chave/);
});

test('endpoints de sugestao estao registrados no router de mobilidade', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/mobilidadeRoutes.js'), 'utf8');
  for (const name of ['/cliente/lugares/sessao', '/cliente/lugares/sugestoes', '/cliente/lugares/detalhes']) assert.ok(source.includes(name));
});
