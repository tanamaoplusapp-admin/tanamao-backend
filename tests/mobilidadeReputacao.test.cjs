const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { obterReputacaoMotorista } = require('../services/mobilidadeReputacao');

test('mostra media e quantidade REAIS, de corridas e perfil do mesmo motorista', async () => {
  let pipeline;
  const avaliacoes = { aggregate: async p => { pipeline = p; return [{ media: 4.66, quantidade: 3 }]; } };
  const resultado = await obterReputacaoMotorista({ avaliacoes, motoristaId:'user-m', profissionalId:'prof-m' });
  assert.deepEqual(resultado, { media: 4.7, quantidade: 3 });
  assert.deepEqual(pipeline[0].$match.nota, {$gte:1,$lte:5});
  assert.equal(pipeline[0].$match.$or.length, 4);
  assert.equal(pipeline[0].$match.$or[3].profissionalId, 'prof-m');
});

test('perfil novo aparece sem avaliacoes e NAO ganha 5 estrelas ficticias', async () => {
  const avaliacoes={aggregate:async()=>[]};
  assert.deepEqual(await obterReputacaoMotorista({avaliacoes,motoristaId:'new'}), { media:null, quantidade:0 });
});

test('ausencia de nota nao produz NaN, e fica inacessivel sem motorista', async () => {
  assert.deepEqual(await obterReputacaoMotorista({avaliacoes:{aggregate:async()=>[{quantidade:1,media:null}]},motoristaId:'1'}), {media:null,quantidade:0});
  assert.deepEqual(await obterReputacaoMotorista({avaliacoes:null,motoristaId:'1'}),{media:null,quantidade:0});
});
