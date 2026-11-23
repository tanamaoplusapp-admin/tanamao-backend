'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(relative,stubs={},env={MOBILITY_GOOGLE_PLACES_API_KEY:'TEST_KEY'}){
 const filename=path.join(__dirname,'..',relative);
 const code=fs.readFileSync(filename,'utf8');
 const module={exports:{}};
 const mockRequire=id=>Object.prototype.hasOwnProperty.call(stubs,id)?stubs[id]:require(id);
 vm.runInNewContext('(function(require,module,exports,process){'+code+'\n})',{}, {filename})(mockRequire,module,module.exports,{env});
 return module.exports;
}
const br=[
 {types:['locality'],longText:'Ponta Pora',shortText:'Ponta Pora'},
 {types:['administrative_area_level_1'],longText:'Mato Grosso do Sul',shortText:'MS'},
 {types:['country'],longText:'Brasil',shortText:'BR'},
];
const py=[
 {types:['locality'],longText:'Pedro Juan Caballero',shortText:'Pedro Juan Caballero'},
 {types:['administrative_area_level_1'],longText:'Amambay',shortText:'Amambay'},
 {types:['country'],longText:'Paraguay',shortText:'PY'},
];
function lugares(axios){return load('services/mobilidadeLugares.js',{axios});}
function res(){let data;return{get:()=>data,set(){return this;},json(d){data=d;return this;}};}
const token='f8b0c5af-3e96-4ef2-95b1-45a874279047';
test('Places keeps Brazilian region plus country code',()=>{
 const point=lugares({}).parsePlace({formattedAddress:'Ponta Pora, Brasil',addressComponents:br,location:{latitude:-22.535,longitude:-55.72}});
 assert.equal(point.uf,'MS');assert.equal(point.pais,'BR');assert.equal(point.cidade,'Ponta Pora');
});
test('Places accepts Paraguay with real department and country code',()=>{
 const point=lugares({}).parsePlace({formattedAddress:'Pedro Juan Caballero, Paraguay',addressComponents:py,location:{latitude:-22.552,longitude:-55.733}});
 assert.equal(point.uf,'PY');assert.equal(point.pais,'PY');assert.equal(point.estado,'Amambay');
});
test('Autocomplete does not exclude PY or other countries and favors nearby places',async()=>{
 const api=lugares({post:async(_,body)=>{
  assert.equal(Object.prototype.hasOwnProperty.call(body,'includedRegionCodes'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(body,'regionCode'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(body,'locationRestriction'),false);
  assert.equal(body.locationBias.circle.center.longitude,-55.73);
  return {data:{suggestions:[{placePrediction:{placeId:'ChIJ123456789abcdef',text:{text:'Pedro Juan Caballero, Paraguay'}}}]}};
 }});
 const r=res();await api.sugestoes({body:{texto:'Pedro Juan Caballero',sessao:token,latitude:-22.54,longitude:-55.73}},r);
 assert.equal(r.get().lugares.length,1);
});
test('Reverse geocoding accepts Paraguayan point without Brazilian UF',()=>{
 const api=lugares({});const point=api.parseReverse({status:'OK',results:[{types:['street_address'],formatted_address:'Pedro Juan Caballero, Amambay, Paraguay',address_components:py.map(x=>({types:x.types,long_name:x.longText,short_name:x.shortText}))}]});
 assert.equal(point.uf,'PY');assert.equal(point.pais,'PY');assert.equal(point.estado,'Amambay');
});
test('Invalid country is rejected with an explicit error',()=>{
 assert.throws(()=>lugares({}).cityState([{types:['locality'],longText:'Test'}]),/Pais nao identificado/);
});
const config={VEHICLES:['carro','moto','van'],SERVICES:[],serviceVehicleCompatible:()=>true,approximateEnabled:()=>false};
const calc=load('services/mobilidadeCalculo.js',{'axios':{},'../config/mobilidade':config});
test('Quote input keeps country, state and backward-compatible Brazilian data',()=>{
 const brPt=calc.point({endereco:'Centro',cidade:'Ponta Pora',uf:'MS',lat:-22.53,lng:-55.73});
 const pyPt=calc.point({endereco:'Centro',cidade:'Pedro Juan Caballero',estado:'Amambay',uf:'PY',pais:'PY',lat:-22.55,lng:-55.73});
 assert.equal(brPt.pais,'BR');assert.equal(pyPt.pais,'PY');assert.equal(pyPt.estado,'Amambay');
 assert.equal(calc.scope(pyPt,pyPt),'frete_local');
 assert.equal(calc.scope(brPt,pyPt),'frete_local');
});
test('Fronteira seca Ponta Pora e PJC aceita corridas, entregas e frete local sem bloqueio por pais',()=>{
 const a=calc.point({endereco:'Brasil',cidade:'Ponta Pora',uf:'MS',pais:'BR',lat:-22.53,lng:-55.73});
 const b=calc.point({endereco:'Paraguai',cidade:'Pedro Juan Caballero',uf:'PY',pais:'PY',estado:'Amambay',lat:-22.55,lng:-55.73});
 assert.equal(calc.fronteiraIntegrada(a,b),true);
 assert.equal(calc.scope(a,b),'frete_local');
 assert.equal(calc.scope(b,a),'frete_local');
 assert.equal(calc.serviceFor('frete','carro',a,b),'frete_local');
 assert.equal(calc.serviceFor('frete','van',b,a),'frete_local');
 assert.equal(calc.serviceFor('corrida','carro',a,b),'corrida_carro');
 assert.equal(calc.serviceFor('corrida','carro',b,a),'corrida_carro');
 assert.equal(calc.serviceFor('entrega','moto',a,b),'entrega_moto');
 assert.equal(calc.serviceFor('entrega','carro',b,a),'entrega_carro');
 assert.equal(calc.tarifaLocalidades(b,a)[2].uf,'MS');
 assert.equal(calc.tarifaLocalidades(b,a)[2].cidade,'ponta pora');
 assert.equal(calc.tarifaLocalidades(a,b).length,3);
});
test('Frete entre outros paises continua classificado corretamente sem ser frete interestadual BR',()=>{
 const a=calc.point({endereco:'Brasil',cidade:'Dourados',uf:'MS',pais:'BR',lat:-22.2,lng:-54.8});
 const b=calc.point({endereco:'Paraguai',cidade:'Asuncion',uf:'PY',pais:'PY',estado:'Central',lat:-25.3,lng:-57.6});
 assert.equal(calc.scope(a,b),'frete_internacional');
 assert.equal(calc.serviceFor('frete','van',a,b),'frete_internacional');
 assert.equal(calc.serviceFor('entrega','carro',a,b),'entrega_carro');
 assert.equal(calc.serviceFor('corrida','carro',a,b),'corrida_carro');
});

function geocodingWith(body){
 const config={approximateEnabled:()=>false};
 const axios={get:async()=>({data:body})};
 return load('services/mobilidadeGeocoding.js',{'axios':axios,'../config/mobilidade':config},{MOBILITY_GOOGLE_GEOCODING_API_KEY:'TEST_KEY'});
}
test('Server validates a location in Pedro Juan Caballero (PY)',async()=>{
 const comps=py.map(x=>({types:x.types,long_name:x.longText,short_name:x.shortText}));
 const geo=geocodingWith({status:'OK',results:[{address_components:comps}]});
 const point={lat:-22.55,lng:-55.74,cidade:'Pedro Juan Caballero',pais:'PY',estado:'Amambay',uf:'PY',endereco:'Centro'};
 assert.equal(await geo.validarLocalidade(point),point);
});
test('Server rejects a mismatch between claimed and geocoded country',async()=>{
 const comps=py.map(x=>({types:x.types,long_name:x.longText,short_name:x.shortText}));
 const geo=geocodingWith({status:'OK',results:[{address_components:comps}]});
 await assert.rejects(()=>geo.validarLocalidade({lat:-22.55,lng:-55.74,cidade:'Pedro Juan Caballero',pais:'BR',uf:'MS'}),/Pais ou cidade nao conferem/);
});
