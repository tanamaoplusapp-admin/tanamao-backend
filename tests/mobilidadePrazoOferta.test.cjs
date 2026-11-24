'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function loadIsolated(filepath,mocks,env={}){
  const module={exports:{}};
  const context={
    module,exports:module.exports,process:{env},
    require:(name)=>{
      if(Object.hasOwn(mocks,name))return mocks[name];
      throw new Error('Unexpected require: '+name);
    },
    console:{log:()=>{},warn:()=>{},error:()=>{}},
    Date,Promise,Math,Number,String,
  };
  vm.runInNewContext(fs.readFileSync(filepath,'utf8'),context,{filename:filepath});
  return module.exports;
}
const services=path.join(__dirname,'../services');
function setupDispatch(env){
  let updateCaptured;
  const job={_id:'ride1',status:'procurando',tentativas:0,servico:'corrida_carro',clienteId:'client1',origem:{lat:-22.5,lng:-55.7},valorCentavos:1850};
  const mocks={
    mongoose:{trusted:x=>x},
    '../models/MobilidadeSolicitacao':{
      findById:()=>({lean:async()=>job}),
      findOneAndUpdate:async(_filter,update)=>{
        updateCaptured=update;
        return {...job,...update.$set};
      },
    },
    './mobilidadeCandidatos':{buscarElegiveis:async()=>[{p:{userId:'driver1'},vehicle:{_id:'vehicle1'},km:0.5}]},
    './mobilidadePoliticaMoto':{consultar:async()=>({permitida:true})},
    './mobilidadeSocket':{emit:()=>{}},
    './pushService':{enviarPushParaUsuario:async()=>true},
  };
  return {
    dispatch:loadIsolated(path.join(services,'mobilidadeDespacho.js'),mocks,env),
    getUpdate:()=>updateCaptured,
  };
}
test('oferta possui 75 segundos por padrao e expiraEm real',async()=>{
  const {dispatch,getUpdate}=setupDispatch();
  const before=Date.now();
  const result=await dispatch.dispatchOne({},'ride1');
  const t=new Date(getUpdate().$set.ofertaExpiraEm).getTime();
  assert.ok(t>=before+75000 && t<=Date.now()+75000);
  assert.ok(result.ofertaExpiraEm);
});
test('prazo e configuravel e limitado entre 30 e 120 segundos',async()=>{
  for(const [raw,want] of [['90',90],['5',30],['999',120]]){
    const {dispatch,getUpdate}=setupDispatch({MOBILITY_OFFER_SECONDS:raw});
    const before=Date.now();
    await dispatch.dispatchOne({},'ride1');
    const delta=new Date(getUpdate().$set.ofertaExpiraEm).getTime()-before;
    assert.ok(delta >= want*1000 && delta<=want*1000+1000,raw+': '+delta);
  }
});
function setupPush(){
  let sent;
  const mocks={
    './firebaseAdmin':{messaging:()=>({send:async m=>{sent=m;return 'message1';}})},
    '../models/user':{findById:()=>({select:()=>({lean:async()=>({fcmToken:'token123',pushEnabled:true})})})},
  };
  return {push:loadIsolated(path.join(services,'pushService.js'),mocks),getSent:()=>sent};
}
test('push de corrida tem validade compatível com a oferta',async()=>{
  const {push,getSent}=setupPush();
  const deadline=new Date(Date.now()+75000).toISOString();
  assert.equal(await push.enviarPushParaUsuario('driver1',{type:'MOBILIDADE_OFERTA',data:{expiraEm:deadline}}),true);
  const sent=getSent();
  assert.ok(sent.android.ttl>70000 && sent.android.ttl<=75000);
  assert.equal(sent.android.notification.channelId,'tanamao-corridas-v1');
  assert.ok(Number(sent.apns.headers['apns-expiration'])>=Math.floor(Date.parse(deadline)/1000)-2);
});
test('push comum nao recebe TTL nem canal de corrida',async()=>{
  const {push,getSent}=setupPush();
  await push.enviarPushParaUsuario('driver1',{type:'NOVA_MENSAGEM'});
  assert.equal(getSent().android.ttl,undefined);
  assert.equal(getSent().android.notification.channelId,'default');
});
