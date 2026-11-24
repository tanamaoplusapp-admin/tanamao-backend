'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');

function mockRequire(modulePath, replacements){
  const saved=Module._load;
  try{
    Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(replacements,request)) return replacements[request];return saved.apply(this,arguments);};
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  }finally{Module._load=saved;}
}
const mockProfiles={
  find:()=>({select:()=>({limit:()=>({lean:async()=>[
    {veiculoAtivoId:'v1',localizacao:{coordinates:[-55.735,-22.536]}},
  ]})})}),
};
let lastVehiclesQuery;
const mockVehicles={find:(query)=>{lastVehiclesQuery=query;return {limit:()=>({lean:async()=>[
  {_id:'v1',tipo:'carro',status:'aprovado',confortoAprovado:true,lugares:5,ano:new Date().getFullYear()-2}
]})};}};
const comfort=mockRequire(path.join(__dirname,'../services/mobilidadeComfort'),{
  '../models/MobilidadePerfil':mockProfiles,
  '../models/MobilidadeVeiculo':mockVehicles,
  './mobilidadeCalculo':{kilometers:()=>2.4},
});

test('Comfort nasce desabilitado sem configuração explícita',()=>{
  const prev=process.env.MOBILITY_COMFORT_ENABLED;
  const rate=process.env.MOBILITY_COMFORT_MARKUP_PERCENT;
  try{
    delete process.env.MOBILITY_COMFORT_ENABLED;delete process.env.MOBILITY_COMFORT_MARKUP_PERCENT;
    assert.equal(comfort.configurado(),false);
    assert.equal(comfort.categoriaCorrida(undefined,'corrida_carro'),'normal');
  }finally{if(prev===undefined)delete process.env.MOBILITY_COMFORT_ENABLED;else process.env.MOBILITY_COMFORT_ENABLED=prev;
    if(rate===undefined)delete process.env.MOBILITY_COMFORT_MARKUP_PERCENT;else process.env.MOBILITY_COMFORT_MARKUP_PERCENT=rate;}
});
test('Categorias inválidas e Comfort em moto são recusados',()=>{
  assert.throws(()=>comfort.categoriaCorrida('outro','corrida_carro'));
  assert.throws(()=>comfort.categoriaCorrida('comfort','corrida_moto'));
});
test('Somente veículo aprovado e espaçoso é elegível ao Comfort',()=>{
  const base={tipo:'carro',status:'aprovado',confortoAprovado:true,lugares:5,ano:new Date().getFullYear()-3};
  assert.equal(comfort.veiculoComfort(base),true);
  assert.equal(comfort.veiculoComfort({...base,confortoAprovado:false}),false);
  assert.equal(comfort.veiculoComfort({...base,status:'pendente'}),false);
  assert.equal(comfort.veiculoComfort({...base,lugares:4}),false);
});
test('Disponibilidade verifica motorista online e veículo autorizado',async()=>{
  const prev=process.env.MOBILITY_COMFORT_ENABLED, rate=process.env.MOBILITY_COMFORT_MARKUP_PERCENT;
  try{
    process.env.MOBILITY_COMFORT_ENABLED='true';process.env.MOBILITY_COMFORT_MARKUP_PERCENT='20';
    assert.equal(comfort.configurado(),true);
    assert.equal(await comfort.disponivelNaOrigem({lat:-22.54,lng:-55.74}),true);
    assert.equal(lastVehiclesQuery.confortoAprovado,true);
    assert.equal(comfort.adicionalComfort(1500),300);
  }finally{if(prev===undefined)delete process.env.MOBILITY_COMFORT_ENABLED;else process.env.MOBILITY_COMFORT_ENABLED=prev;
    if(rate===undefined)delete process.env.MOBILITY_COMFORT_MARKUP_PERCENT;else process.env.MOBILITY_COMFORT_MARKUP_PERCENT=rate;}
});
test('Notificações são enviadas ao cliente para aceite e chegada, sem GPS no payload',async()=>{
  const enviados=[];
  const n=mockRequire(path.join(__dirname,'../services/mobilidadeNotificacoesCliente'),{'./pushService':{enviarPushParaUsuario:async(id,payload)=>{enviados.push({id,payload});return true;}}});
  n.notificarClienteEtapa('cliente01','sol01','aceita');
  n.notificarClienteEtapa('cliente01','sol01','no_local');
  n.notificarClienteEtapa('cliente01','sol01','invalido');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(enviados.length,2);
  assert.deepEqual(enviados.map(x=>x.payload.data.status),['aceita','no_local']);
  assert.ok(enviados.every(x=>x.payload.type==='MOBILIDADE_CLIENTE_STATUS'));
  assert.ok(enviados.every(x=>!('lat' in x.payload.data)));
});
test('Controlador persiste estado antes de enviar push, sem substituir a liberação manual',()=>{
  const s=fs.readFileSync(path.join(__dirname,'../controllers/mobilidadeController.js'),'utf8');
  assert.ok(s.includes("notificarClienteEtapa(job.clienteId,job._id,'aceita')"));
  assert.ok(s.includes("notificarClienteEtapa(j.clienteId,j._id,'no_local')"));
  assert.ok(s.includes("notificarClienteEtapa(job.clienteId,job._id,next)"));
  assert.ok(s.includes('documentosAutorizados(profile,usuario)'));
});
