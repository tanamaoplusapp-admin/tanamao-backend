'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const A=require('../services/mobilidadeAgendaDinamica');
const p={uf:'MS',cidade:'Ponta Porã',pais:'BR'};
const when=(s,c=A.defaults(),where=p)=>A.evaluate(where,c,new Date(s));
test('local MS: pico da manhã, almoço e tarde',()=>{
 assert.equal(when('2026-11-24T10:00:00Z').fator,1.15);
 assert.equal(when('2026-11-24T15:00:00Z').fator,1.10);
 assert.equal(when('2026-11-24T21:00:00Z').fator,1.20);
 assert.equal(when('2026-11-24T12:30:00Z').fator,1);
});
test('madrugada prevalece sobre feriado e fim de semana',()=>{
 assert.equal(when('2026-12-25T07:00:00Z').fator,1.30);
 assert.equal(when('2026-11-28T06:00:00Z').fator,1.30);
 assert.equal(when('2026-11-28T18:00:00Z').fator,1.15);
 assert.equal(when('2026-11-20T21:00:00Z').fator,1.25);
});
test('sexta à noite e fuso de SP',()=>{
 assert.equal(when('2026-11-28T00:00:00Z').fator,1.20);
 assert.equal(when('2026-11-24T09:30:00Z',A.defaults(),{uf:'SP',cidade:'São Paulo'}).fator,1.15);
 assert.equal(when('2026-11-24T09:30:00Z').fator,1.30);
});
test('feriados adicionais recorrentes, específicos e herdados',()=>{
 const cfg=A.validate({...A.defaults(),feriados:['2026-11-24'],feriadosRecorrentes:['11-25']});
 assert.equal(when('2026-11-24T18:00:00Z',cfg).fator,1.25);
 assert.equal(when('2027-11-25T18:00:00Z',cfg).fator,1.25);
 assert.equal(A.evaluate(p,A.defaults(),new Date('2026-11-24T18:00:00Z'),[],['11-24']).fator,1.25);
});
test('configuração desativada e Paraguai',()=>{
 assert.equal(when('2026-11-24T10:00:00Z',{...A.defaults(),ativo:false}).fator,1);
 assert.equal(when('2026-11-24T10:00:00Z',A.defaults(),{uf:'PY',pais:'PY'}).fator,1);
});
test('validação rejeita percentuais altos e datas inválidas',()=>{
 assert.throws(()=>A.validate({...A.defaults(),percentuais:{...A.defaults().percentuais,madrugada:31}}));
 assert.throws(()=>A.validate({...A.defaults(),feriadosRecorrentes:['02-30']}));
 assert.throws(()=>A.validate({...A.defaults(),feriados:['2026-02-29']}));
 assert.throws(()=>A.validate({...A.defaults(),horarios:{...A.defaults().horarios,sexta:{inicio:1200,fim:1200}}}));
 assert.deepEqual(A.scope('ms','Ponta Porã'),{uf:'MS',cidade:'ponta pora'});
});
test('bloqueio de ambiente não depende de MongoDB',async()=>{
 const old=process.env.MOBILITY_DYNAMIC_PRICING;process.env.MOBILITY_DYNAMIC_PRICING='false';
 try{assert.deepEqual(await A.scheduled(p,'corrida_carro'),{fator:1,motivo:null,permitida:false});}
 finally{if(old===undefined)delete process.env.MOBILITY_DYNAMIC_PRICING;else process.env.MOBILITY_DYNAMIC_PRICING=old;}
});
