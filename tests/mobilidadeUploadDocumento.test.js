'use strict';
// Regressao para o erro real do Render: "ReferenceError: veiculoId is not defined".
// Verifica o fluxo real de uploadDocument com modelos e GridFS substituidos por dublês.
// Nao utiliza imagens reais, banco, tokens ou conexao externa.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Writable } = require('node:stream');

const controllerPath = path.resolve(__dirname, '../controllers/mobilidadeController.js');

function montarCenario({ tipo, vehicleId } = {}) {
  const documentos = [];
  const atualizacoesVeiculo = [];
  const files = [];
  let codigoHttp = null;
  let resposta = null;
  let consultaVeiculo = null;
  let proximoDocumento = 0;
  const perfil = {
    _id: 'perfil-1', userId: 'motorista-1', profissionalId: 'prof-1',
    cnh: { status: 'aprovado' }, status: 'aprovado', online: true,
    servicosAprovados: ['corrida_carro'], servicosAtivos: ['corrida_carro'],
    emViagemId: null,
    async save() { return this; }
  };
  class FakeGridFSBucket {
    openUploadStream(_nome, options) {
      const fluxo = new Writable({ write(_chunk, _encoding, done) { done(); } });
      fluxo.id = `arquivo-${++proximoDocumento}`;
      files.push({ id: fluxo.id, options, deleted: false });
      return fluxo;
    }
    async delete(id) {
      const row = files.find(x => x.id === id);
      if (row) row.deleted = true;
    }
  }
  const mocks = {
    mongoose: { connection: { db: {} }, mongo: { GridFSBucket: FakeGridFSBucket }, trusted: x => x },
    multer: Object.assign(() => ({ single: () => () => {} }), { memoryStorage: () => ({}) }),
    '../middleware/mobilidade': {
      ownedProfessional: async () => ({ prof: { _id: 'prof-1' }, owner: 'motorista-1' }),
      id: x => x,
      error: (status, msg) => { const err = new Error(msg); err.status = status; throw err; },
      audit: async () => {}
    },
    '../models/MobilidadePerfil': { findOne: async () => perfil },
    '../models/MobilidadeVeiculo': {
      findOne: async filtro => {
        consultaVeiculo = filtro;
        return filtro._id === 'veiculo-1' && filtro.userId === 'motorista-1' ? { _id: 'veiculo-1' } : null;
      },
      updateOne: async (...args) => { atualizacoesVeiculo.push(args); }
    },
    '../models/MobilidadeDocumento': {
      create: async row => {
        documentos.push(row);
        return { _id: `documento-${documentos.length}`, tipo: row.tipo, createdAt: new Date() };
      }
    }
  };
  const localRequire = name => {
    if (name.startsWith('node:')) return require(name);
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    if (name.startsWith('../')) return {};
    throw Error('Dependencia inesperada: ' + name);
  };
  const module = { exports: {} };
  const wrapper = vm.runInThisContext(`(function(require,module,exports){\n${fs.readFileSync(controllerPath, 'utf8')}\n})`, {filename: controllerPath});
  wrapper(localRequire, module, module.exports);
  const req = {
    userId: 'motorista-1', body: { tipo, ...(vehicleId ? { veiculoId: vehicleId } : {}) },
    file: { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimetype: 'image/jpeg', originalname: 'imagem.jpg', size: 4 }
  };
  const res = {
    status(n) { codigoHttp = n; return this; },
    json(payload) { resposta = payload; return this; }
  };
  return {
    upload: () => module.exports.uploadDocument(req, res),
    docs: () => documentos, files: () => files, perfil,
    veiculos: () => atualizacoesVeiculo,
    consultaVeiculo: () => consultaVeiculo,
    http: () => codigoHttp, resposta: () => resposta
  };
}

test('CNH frente: salva documento, veiculoId nulo, finaliza sem ReferenceError', async () => {
  const c = montarCenario({ tipo: 'cnh_frente' });
  await c.upload();
  assert.equal(c.http(), 201);
  assert.equal(c.resposta().ok, true);
  assert.equal(c.docs().length, 1);
  assert.equal(c.docs()[0].veiculoId, null);
  assert.equal(c.docs()[0].tipo, 'cnh_frente');
  assert.equal(c.files().length, 1);
  assert.equal(c.files()[0].deleted, false);
  assert.equal(c.perfil.cnh.status, 'pendente');
  assert.equal(c.perfil.online, false);
});

test('CNH verso: persiste normalmente sem exigir veiculo', async () => {
  const c = montarCenario({ tipo: 'cnh_verso' });
  await c.upload();
  assert.equal(c.http(), 201);
  assert.equal(c.docs()[0].veiculoId, null);
});

test('CRLV: valida propriedade do veiculo, associa seu ID e solicita nova aprovacao', async () => {
  const c = montarCenario({ tipo: 'crlv', vehicleId: 'veiculo-1' });
  await c.upload();
  assert.equal(c.http(), 201);
  assert.deepEqual(c.consultaVeiculo(), { _id: 'veiculo-1', userId: 'motorista-1' });
  assert.equal(c.docs()[0].veiculoId, 'veiculo-1');
  assert.equal(c.veiculos().length, 1);
  assert.equal(c.veiculos()[0][0]._id, 'veiculo-1');
});

test('CRLV: impede documento para veiculo inexistente antes de gravar o arquivo', async () => {
  const c = montarCenario({ tipo: 'crlv', vehicleId: 'veiculo-de-outra-conta' });
  await assert.rejects(() => c.upload(), { status: 404 });
  assert.equal(c.docs().length, 0);
  assert.equal(c.files().length, 0);
});
