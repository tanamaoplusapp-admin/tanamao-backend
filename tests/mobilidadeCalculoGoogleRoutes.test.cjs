'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const a = {lat:-22.54,lng:-55.72,endereco:'Rua Manoel Dias de Pinho, 238 - Centro, Ponta Pora - MS',cidade:'Ponta Pora',uf:'MS',pais:'BR'};
const b = {lat:-22.535,lng:-55.718,endereco:'Rua Guia Lopes, 1425 - Vila Militar, Ponta Pora - MS',cidade:'Ponta Pora',uf:'MS',pais:'BR'};
function load(behavior, key='CHAVE_FICTICIA', approximate=false){
 const source=fs.readFileSync(path.resolve(__dirname,'../services/mobilidadeCalculo.js'),'utf8');
 const calls=[];
 const warnings=[];
 const mod={exports:{}};
 const mockedRequire=(name)=>{
  if(name==='axios')return {post:async (url,data,opts)=>{
   calls.push({url,data,opts});
   return behavior(data,calls.length);
  }};
  if(name==='../config/mobilidade')return {VEHICLES:['carro','moto','van'],serviceVehicleCompatible:()=>true,approximateEnabled:()=>approximate};
  throw Error('Require inesperado: '+name);
 };
 const runner=vm.runInNewContext('(function(require,module,exports,process,console){'+source+'\n})',{}, {filename:'mobilidadeCalculo.js'});
 runner(mockedRequire,mod,mod.exports,{env:key?{MOBILITY_GOOGLE_ROUTES_API_KEY:key}:{}},{warn:(...x)=>warnings.push(x)});
 return {api:mod.exports,calls,warnings};
}
function routeResponse(meters=644,duration='120s'){return {data:{routes:[{distanceMeters:meters,duration}]}};}

test('Google Routes por coordenadas fornece rota real e minutos',async()=>{
 const {api,calls}=load(async()=>routeResponse(644,'125s'));
 const r=await api.route(a,b);
 assert.equal(r.km,0.644);assert.equal(r.min,3);assert.equal(r.method,'google_routes');assert.equal(calls.length,1);
 assert.ok(calls[0].data.origin.location.latLng);
});
test('HTTP 200 sem rota por coordenadas tenta enderecos e encontra rota real',async()=>{
 const {api,calls}=load(async(payload,number)=>number===1?{data:{routes:[]}}:routeResponse(644,'90s'));
 const result=await api.route(a,b);
 assert.equal(result.km,0.644);assert.equal(calls.length,2);
 assert.ok(calls[1].data.origin.address.includes('Manoel'));
 assert.ok(calls[1].data.destination.address.includes('Guia Lopes'));
});
test('Rotas ausentes por ambas as formas nao geram falsa mensagem de chave ausente',async()=>{
 const {api,calls,warnings}=load(async()=>({data:{routes:[]}}));
 await assert.rejects(()=>api.route(a,b),(err)=>err.status===422 && /Ajuste a origem/.test(err.message) && !err.message.includes('MOBILITY_GOOGLE_ROUTES_API_KEY'));
 assert.equal(calls.length,2);assert.ok(warnings.some(x=>String(x[0]).includes('Sem trajeto')));
});
test('Google retorna 403 e sistema informa indisponibilidade sem expor chave',async()=>{
 const {api,calls,warnings}=load(async()=>{const e=Error('prohibited');e.response={status:403};throw e;});
 await assert.rejects(()=>api.route(a,b),(err)=>err.status===503 && /indisponível/.test(err.message));
 assert.equal(calls.length,1);assert.equal(warnings[0][2],403);
});
test('Sem chave configurada retorna 503 e nao chama a API',async()=>{
 const {api,calls}=load(async()=>{throw Error('nao deveria chamar');},'');
 await assert.rejects(()=>api.route(a,b),err=>err.status===503 && /temporariamente/.test(err.message));
 assert.equal(calls.length,0);
});
test('Origem e destino no mesmo local impedem cotacao incorreta',async()=>{
 const {api,calls}=load(async()=>routeResponse(0));
 await assert.rejects(()=>api.route(a,{...a}),err=>err.status===400 && /mesmo local/.test(err.message));
 assert.equal(calls.length,0);
});
test('Rota por endereco muito longa nao pode ser usada sem verificacao',async()=>{
 const {api}=load(async(_,i)=>i===1?{data:{routes:[]}}:routeResponse(250000));
 await assert.rejects(()=>api.route(a,b),err=>err.status===422);
});
test('Estimativa so e permitida quando modo opt-in esta habilitado',async()=>{
 const {api}=load(async()=>({data:{routes:[]}}),'CHAVE_FICTICIA',true);
 const r=await api.route(a,b);assert.equal(r.method,'aproximacao');
});
