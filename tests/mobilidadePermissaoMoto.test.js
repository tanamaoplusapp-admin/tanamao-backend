'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {motoPassengerAllowed,politicaCorridaMoto,serviceVehicleCompatible} = require('../config/mobilidade');

const EN = 'MOBILITY_MOTO_PASSENGER_ENABLED';
const AL = 'MOBILITY_MOTO_APPROVED_CITIES';
const old = {[EN]:process.env[EN], [AL]:process.env[AL]};
function configure(enabled, cities) {
  if (enabled === undefined) delete process.env[EN]; else process.env[EN]=enabled;
  if (cities === undefined) delete process.env[AL]; else process.env[AL]=cities;
}

test('moto de passageiros bloqueada por padrao, sem liberar Ponta Pora ou PY automaticamente', () => {
  configure(undefined, undefined);
  assert.equal(motoPassengerAllowed('Ponta Pora', 'MS', 'BR'),false);
  assert.equal(motoPassengerAllowed('Pedro Juan Caballero', 'PY', 'PY'),false);
  assert.equal(politicaCorridaMoto({cidade:'Ponta Porã',uf:'MS',pais:'BR'}).permitida,false);
});

test('a chave global so habilita cidades explicitamente cadastradas', () => {
  configure('true', '');
  assert.equal(motoPassengerAllowed('Ponta Pora','MS','BR'),false);
  configure('true','Cidade Licenciada,MS,BR;Municipio Autorizado,PY,PY');
  assert.equal(motoPassengerAllowed('Cidade Licenciada','MS','BR'),true);
  assert.equal(motoPassengerAllowed('CIDADE LICENCIADA','MS','BR'),true);
  assert.equal(motoPassengerAllowed('Município Autorizado','PY','PY'),true);
  assert.equal(motoPassengerAllowed('Cidade Licenciada','MS','PY'),false);
  assert.equal(motoPassengerAllowed('Ponta Porã','MS','BR'),false);
});

test('suporta cidades com acento, sem correspondencia parcial e compatibilidade de formato antigo', () => {
  configure('true','São José,SP;Cidade Independente,PY');
  assert.equal(motoPassengerAllowed('Sao Jose','SP','BR'),true);
  assert.equal(motoPassengerAllowed('Sao Jose Norte','SP','BR'),false);
  assert.equal(motoPassengerAllowed('Cidade Independente','PY','PY'),true);
  assert.equal(motoPassengerAllowed('Cidade Independente','PY','BR'),false);
});

test('desligar a chave global bloqueia inclusive cidades cadastradas', () => {
  configure('false','Cidade Licenciada,MS,BR');
  assert.equal(motoPassengerAllowed('Cidade Licenciada','MS','BR'),false);
  assert.equal(politicaCorridaMoto({cidade:'Cidade Licenciada',uf:'MS',pais:'BR'}).codigo,'NAO_HABILITADA');
});

test('sem cidade ou UF validas nega, e entregas moto nao usam esta autorizacao de passageiros', () => {
  configure('true','Cidade Licenciada,MS,BR');
  assert.equal(motoPassengerAllowed('','MS','BR'),false);
  assert.equal(motoPassengerAllowed('Cidade Licenciada','','BR'),false);
  assert.equal(serviceVehicleCompatible('entrega_moto','moto'),true);
  assert.equal(serviceVehicleCompatible('corrida_moto','carro'),false);
});

test('politica retorna justificativa sem afirmar autorizacao municipal automatica', () => {
  configure('true', 'Cidade Licenciada,MS,BR');
  const permitido=politicaCorridaMoto({cidade:'Cidade Licenciada',uf:'MS',pais:'BR'});
  assert.equal(permitido.permitida,true);
  assert.match(permitido.mensagem,/habilitada/i);
  const negado=politicaCorridaMoto({cidade:'Outra Cidade',uf:'MS',pais:'BR'});
  assert.equal(negado.permitida,false);
  assert.match(negado.mensagem,/ainda nao estao habilitadas/i);
});

test('restaura ambiente', () => {
  for(const key of [EN, AL]) {
    if(old[key]===undefined) delete process.env[key]; else process.env[key]=old[key];
  }
});
