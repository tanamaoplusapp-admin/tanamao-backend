'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { atividadeMobilidade, ehApenasMotorista, somenteBuscaTradicional, termoBuscaMobilidade } = require('../services/mobilidadeVisibilidade');

test('Motorista isolado nao aparece na busca tradicional', () => {
  const motorista = { profissaoNome:'Motorista',profissoes:['Motorista'],profissoesDetalhadas:[{nome:'Motorista',profissaoId:'id-1'}]};
  assert.equal(ehApenasMotorista(motorista), true);
  assert.equal(somenteBuscaTradicional(motorista), null);
});
test('Motorista misto aparece somente como profissao tradicional', () => {
  const ambos = { profissaoNome:'Motorista',profissoes:['Motorista','Eletricista'],profissoesDetalhadas:[{nome:'Motorista',profissaoId:'m',categoriaId:'c1'},{nome:'Eletricista',profissaoId:'e',categoriaId:'c2'}]};
  const vista = somenteBuscaTradicional(ambos);
  assert.deepEqual(vista.profissoes,['Eletricista']);
  assert.equal(vista.profissaoNome,'Eletricista');
  assert.equal(vista.profissaoId,'e');
  assert.equal(vista.profissoesDetalhadas.length,1);
  assert.equal(ambos.profissaoNome,'Motorista');
});
test('Prestador comum nao sofre alteracoes', () => {
  const outro = {profissaoNome:'Pedreiro',profissoes:['Pedreiro']};
  assert.equal(somenteBuscaTradicional(outro), outro);
});
test('Motorista com descricao entre parenteses identificado', () => {
  assert.equal(atividadeMobilidade('Motorista (Uber, entregas, fretes)'),true);
  assert.equal(atividadeMobilidade('Motorista de aplicativo'),true);
});
test('Busca textual motorista deve usar mobilidade e nao busca de profissao', () => {
  assert.equal(termoBuscaMobilidade('Motorista perto de mim'),true);
  assert.equal(termoBuscaMobilidade('Pintor'),false);
});
