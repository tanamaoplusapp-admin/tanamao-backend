'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../scripts/cadastrarTarifasBrasil.cjs');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

test('27 UFs e 5 cidades pesquisadas cobertas sem duplicacoes',()=>{
 const rows=T.tarifasParaTodasCidades();
 assert.equal(Object.keys(T.GAS_UF).length,27);
 assert.equal(rows.length,256);
 assert.equal(rows.filter(r=>r.cidade==='*').length,27*8);
 assert.equal(rows.filter(r=>r.ativo).length,0);
 assert.equal(new Set(rows.map(r=>r.uf+'|'+r.cidade+'|'+r.servico)).size,256);
 assert.ok(T.validarDados(rows));
});

test('Normal Ponta Pora: R$3,50 + R$1,60/km + R$0,15/min; minimo R$8,90',()=>{
 const r=T.obterTarifaAplicavel('corrida_carro','MS','Ponta Porã');
 assert.equal(r.cidade,'ponta pora');
 assert.deepEqual([r.bandeiradaCentavos,r.porKmCentavos,r.porMinutoCentavos,r.minimoCentavos],[350,160,15,890]);
 assert.equal(T.simulacao(r,5,10),1300);
 assert.equal(T.simulacao(r,1,2),890);
 assert.equal(r.dinamicaAtiva,false);
});

test('Comfort usa +25% na base Normal, sem servico extra ou habilitacao automatica',()=>{
 const t=T.obterTarifaAplicavel('corrida_carro','MS','Ponta Porã');
 assert.equal(T.PERCENTUAL_COMFORT,25);
 assert.equal(T.simularComfort(t,5,10),1625);
 assert.equal(T.simularComfort(t,1,2),1113);
 assert.equal(T.BASE.filter(row=>row[0]==='corrida_comfort').length,0);
});

test('tarifa minima Normal em qualquer local e R$8,90, com ajuste suave no KM',()=>{
 const r=T.tarifasParaTodasCidades().filter(r=>r.servico==='corrida_carro');
 assert.equal(r.length,32);
 assert.ok(r.every(row=>row.bandeiradaCentavos===350&&row.minimoCentavos===890&&row.porMinutoCentavos===15));
 assert.ok(r.every(row=>row.porKmCentavos>=150&&row.porKmCentavos<=173));
 const cg=T.obterTarifaAplicavel('corrida_carro','MS','Campo Grande');
 const pp=T.obterTarifaAplicavel('corrida_carro','MS','Ponta Porã');
 assert.ok(cg.porKmCentavos<pp.porKmCentavos);
 assert.equal(T.obterTarifaAplicavel('corrida_carro','SP','Campinas').cidade,'*');
});

test('entregas e fretes nao foram alterados por causa da revisao de carros',()=>{
 const moto=T.obterTarifaAplicavel('corrida_moto','MS','Ponta Porã');
 assert.equal(moto.minimoCentavos,814);
 const frete=T.obterTarifaAplicavel('frete_local','MS','Ponta Porã');
 assert.ok(frete.minimoCentavos>moto.minimoCentavos);
});

test('nenhuma aprovacao de moto, cidade ou motorista e gerada',()=>{
 const rows=T.tarifasParaTodasCidades({ativarBase:true});
 assert.ok(rows.some(r=>r.servico==='corrida_moto'&&r.ativo===true));
 assert.ok(rows.every(r=>r.politicaMoto===undefined&&r.aprovacaoMotorista===undefined));
 assert.ok(rows.filter(r=>r.servico==='frete_internacional').every(r=>!r.ativo));
});

test('valores exatos da antiga semente comparados antes de qualquer substituicao',()=>{
 const old=T.tarifaNacionalAnterior('corrida_carro','MS','Ponta Porã');
 assert.deepEqual(old,{bandeiradaCentavos:505,porKmCentavos:201,porMinutoCentavos:21,minimoCentavos:1330});
 assert.notDeepEqual(old,T.obterTarifaAplicavel('corrida_carro','MS','Ponta Porã'));
 assert.deepEqual(T.tarifaLocalInicialAnterior('corrida_carro','MS','Ponta Porã'),{bandeiradaCentavos:490,porKmCentavos:195,porMinutoCentavos:20,minimoCentavos:1290});
 assert.equal(T.tarifaLocalInicialAnterior('corrida_carro','RJ','Rio de Janeiro'),null);
});

test('comando de substituicao de semente antiga exige opcao explicita de aplicacao',()=>{
 assert.equal(T.flags(['--preview']).aplicar,false);
 assert.equal(T.flags(['--csv']).csv,true);
 assert.throws(()=>T.flags(['--ativar-base']));
 assert.throws(()=>T.flags(['--atualizar-sementes-antigas']));
 assert.throws(()=>T.flags(['--aplicar']));
 assert.equal(T.flags(['--aplicar','--atualizar-sementes-antigas','--confirmar=CADASTRAR_TARIFAS_ESTIMADAS']).atualizarSementesAntigas,true);
});

test('CSV por municipio usa a mesma tarifa normal e nao cria servico Comfort duplicado',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tanamao-tarifas-'));
 try{
  const dest=path.join(tmp,'tarifas.csv');
  const total=T.gravarCSV([{id:'5006606',uf:'MS',cidade:'ponta pora',nome:'Ponta Porã'}],{arquivo:dest});
  assert.equal(total.count,8);
  const body=fs.readFileSync(dest,'utf8');
  assert.ok(body.includes('Ponta Porã;MS;corrida_carro;350;160;15;890;false;ANP_municipio;ESTIMATIVA_NAO_OFICIAL'));
  assert.ok(!body.includes('corrida_comfort'));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('normaliza nomes do IBGE e acentos',()=>{
 assert.equal(T.normalizarCidade('  Três  Lagoas '),'tres lagoas');
 assert.deepEqual(T.municipioParaRegistro({id:5006606,nome:'Ponta Porã','regiao-imediata':{'regiao-intermediaria':{UF:{sigla:'MS'}}}}),{id:'5006606',cidade:'ponta pora',uf:'MS',nome:'Ponta Porã'});
});
