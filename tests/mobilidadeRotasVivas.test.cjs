'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const source=path.resolve(__dirname,'../services/mobilidadeRotasVivas.js');
const original=Module._load;
let job,profile,calls=0;
function mockRes(){return{statusCode:200,jsonBody:null,headers:{},status(c){this.statusCode=c;return this;},json(x){this.jsonBody=x;return this;},set(k,v){this.headers[k]=v;return this;}};}
const dependencies={
 axios:{post:async(url,body,opt)=>{calls++;assert.equal(opt.headers['X-Goog-Api-Key'],'dummy-test-key');assert.match(opt.headers['X-Goog-FieldMask'],/encodedPolyline/);return {data:{routes:[{distanceMeters:2000,duration:'310s',polyline:{encodedPolyline:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'}}]}};}},
 mongoose:{isValidObjectId:()=>true},
 '../models/MobilidadeSolicitacao':{findById:()=>({lean:async()=>job})},
 '../models/MobilidadePerfil':{findOne:()=>({select:()=>({lean:async()=>profile})})},
};
Module._load=function(req,parent,isMain){if(Object.hasOwn(dependencies,req))return dependencies[req];return original.call(this,req,parent,isMain);};
const {rotaViagem,toPoint,gpsPoint}=require(source);
Module._load=original;
const request=()=>({userId:'u-driver',params:{jobId:'ride-1'}});
function reset(){job={_id:'ride-1',motoristaId:'u-driver',clienteId:'u-client',status:'aceita',origem:{lat:-22.54,lng:-55.73},destino:{lat:-22.53,lng:-55.72}};
 profile={localizacao:{coordinates:[-55.735,-22.542]},ultimaLocalizacaoEm:new Date()};calls=0;process.env.MOBILITY_GOOGLE_ROUTES_API_KEY='dummy-test-key';}
test('coordinates are normalized without guesswork',()=>{assert.deepEqual(toPoint({lat:2,lng:3}),{lat:2,lng:3});assert.equal(toPoint({lat:120,lng:3}),null);assert.deepEqual(gpsPoint({coordinates:[-55,-22]}),{lat:-22,lng:-55});});
test('blocks other user from route and from Google calls',async()=>{reset();const res=mockRes();await rotaViagem({userId:'another',params:{jobId:'ride-1'}},res);assert.equal(res.statusCode,403);assert.equal(calls,0);});
test('returns real encoded route to authorized driver',async()=>{reset();const res=mockRes();await rotaViagem(request(),res);assert.equal(res.statusCode,200);assert.equal(res.jsonBody.disponivel,true);assert.equal(res.jsonBody.etapa,'embarque');assert.equal(res.jsonBody.duracaoMinutos,6);assert.equal(calls,1);});
test('after starting trip switches destination',async()=>{reset();job.status='em_andamento';let res=mockRes();await rotaViagem(request(),res);assert.equal(res.jsonBody.etapa,'destino');});
test('never fakes a route when GPS is stale',async()=>{reset();profile.ultimaLocalizacaoEm=new Date(Date.now()-1000000);let res=mockRes();await rotaViagem(request(),res);assert.equal(res.jsonBody.disponivel,false);assert.equal(calls,0);});
test('client can see assigned driver route but unrelated user cannot',async()=>{reset();let res=mockRes();await rotaViagem({userId:'u-client',params:{jobId:'ride-1'}},res);assert.equal(res.jsonBody.disponivel,true);});
