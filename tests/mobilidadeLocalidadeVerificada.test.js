'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { assinarPonto, validarProva } = require('../services/mobilidadePontoVerificado');
process.env.MOBILITY_DATA_KEY = '9a'.repeat(32);
process.env.MOBILITY_GOOGLE_PLACES_API_KEY = 'TEST_ONLY_GOOGLE_KEY';
process.env.MOBILITY_GOOGLE_GEOCODING_API_KEY = 'TEST_ONLY_GOOGLE_KEY';

const br = { endereco: 'R. Manoel Dias de Pinho, 627 - Centro, Ponta Pora - MS, Brasil',
  cidade: 'Ponta Porã', uf: 'MS', pais: 'BR', estado: 'Mato Grosso do Sul', lat: -22.536, lng: -55.726 };
const py = { endereco: 'Av. Carlos A. Lopez, Pedro Juan Caballero 130103, Paraguay',
  cidade: 'Pedro Juan Caballero', uf: 'PY', pais: 'PY', estado: 'Amambay', lat: -22.55, lng: -55.734 };
const brComponents = [
  { types: ['locality'], long_name: 'Ponta Porã', short_name: 'Ponta Porã' },
  { types: ['administrative_area_level_1'], long_name: 'Mato Grosso do Sul', short_name: 'MS' },
  { types: ['country'], long_name: 'Brasil', short_name: 'BR' },
];
const pyComponents = [
  { types: ['locality'], long_name: 'Pedro Juan Caballero', short_name: 'Pedro Juan Caballero' },
  { types: ['administrative_area_level_1'], long_name: 'Amambay', short_name: 'Amambay' },
  { types: ['country'], long_name: 'Paraguay', short_name: 'PY' },
];
function load(relative, mocks={}) {
  const filename=path.resolve(__dirname, '..', relative);
  const code=fs.readFileSync(filename,'utf8');
  const mod={exports:{}};
  const localRequire=id=>Object.prototype.hasOwnProperty.call(mocks,id)?mocks[id]:require(id);
  vm.runInNewContext('(function(require,module,exports,process){'+code+'\n})',{}, {filename})(localRequire,mod,mod.exports,{env:process.env});
  return mod.exports;
}
function response(){let result;return {set(){return this;},json(x){result=x;return this;},get(){return result;}};}
function service(axiosStub) {return load('services/mobilidadeGeocoding.js', {'axios':axiosStub,
  '../config/mobilidade':{approximateEnabled:()=>false}, './mobilidadePontoVerificado':{validarProva}});}

// As assinaturas sao emitidas pela API, nao pelo cliente.
test('Ponta Pora e Pedro Juan Caballero podem ser assinados e verificados',()=>{
  assert.equal(validarProva(br, assinarPonto(br)),true);
  assert.equal(validarProva(py, assinarPonto(py)),true);
});
test('uma assinatura nao pode ser reutilizada com outra cidade, pais ou latitude',()=>{
  const assinatura=assinarPonto(py);
  for(const trocado of [{...py,pais:'BR'},{...py,uf:'MS'},{...py,cidade:'Ponta Porã'},
    {...py,lat:py.lat+0.01},{...py,endereco:'Rua diferente'}]) {
    assert.equal(validarProva(trocado,assinatura),false);
  }
});
test('assinaturas expiram e nao aceitam emitidas no futuro',()=>{
  const emitido=Date.now();
  assert.equal(validarProva(py,assinarPonto(py,emitido-31*60000),emitido),false);
  assert.equal(validarProva(py,assinarPonto(py,emitido+2*60000),emitido),false);
  assert.equal(validarProva(py,assinarPonto(py,emitido-5*60000),emitido),true);
});
test('assinatura invalida e rejeitada sem permitir alterar o pais',()=>{
  assert.equal(validarProva(br,'inválida'),false);
  assert.equal(validarProva(br,assinarPonto(py)),false);
});
test('cotacao usa prova assinada e nao repete consulta reverse geocode em ponto ja validado',async()=>{
  const geo=service({get:()=>{throw Error('Nao deve consultar Google novamente');}});
  assert.deepEqual({...await geo.validarLocalidade(br,assinarPonto(br))},br);
  assert.deepEqual({...await geo.validarLocalidade(py,assinarPonto(py))},py);
});
test('cliente legado: quando Google retorna BR primeiro e PY depois, aceita apenas o candidato PY',async()=>{
  const geo=service({get:async()=>({data:{status:'OK',results:[
    {address_components:brComponents},
    {address_components:pyComponents},
  ]}})});
  assert.equal(await geo.validarLocalidade(py),py);
});
test('sem prova, cidade e pais falsificados continuam bloqueados',async()=>{
  const geo=service({get:async()=>({data:{status:'OK',results:[{address_components:brComponents}]}})});
  await assert.rejects(()=>geo.validarLocalidade(py),/Pais ou cidade nao conferem/);
});
test('Places Details devolve ponto com comprovante sem expor chave',async()=>{
  const places=load('services/mobilidadeLugares.js', {'axios':{get:async()=>({data:{formattedAddress:py.endereco,
    location:{latitude:py.lat,longitude:py.lng},addressComponents:pyComponents.map(c=>({types:c.types,longText:c.long_name,shortText:c.short_name}))}})},
    './mobilidadePontoVerificado':{assinarPonto}});
  const res=response();await places.detalhes({body:{placeId:'ChIJ123456789abcdef',sessao:'f8b0c5af-3e96-4ef2-95b1-45a874279047'}},res);
  const retorno=res.get().ponto;
  assert.equal(retorno.pais,'PY');assert.equal(retorno.cidade,'Pedro Juan Caballero');
  assert.equal(validarProva(retorno,retorno.validacao),true);
  assert.equal(JSON.stringify(retorno).includes(process.env.MOBILITY_DATA_KEY),false);
});
test('ponto escolhido no mapa tambem recebe comprovante',async()=>{
  const places=load('services/mobilidadeLugares.js', {'axios':{get:async()=>({data:{status:'OK',results:[{
    formatted_address:br.endereco,types:['street_address'],address_components:brComponents,
  }]}})},'./mobilidadePontoVerificado':{assinarPonto}});
  const res=response();await places.reverso({body:{lat:br.lat,lng:br.lng}},res);
  const ponto=res.get().ponto;assert.equal(validarProva(ponto,ponto.validacao),true);
});
test('controlador de cotacao valida provas recebidas do cliente sem gravar token no modelo',()=>{
  const controller=fs.readFileSync(path.resolve(__dirname,'../controllers/mobilidadeController.js'),'utf8');
  assert.match(controller,/validarLocalidade\(params\.origem, req\.body\?\.origem\?\.validacao\)/);
  assert.match(controller,/validarLocalidade\(params\.destino, req\.body\?\.destino\?\.validacao\)/);
  const calc=fs.readFileSync(path.resolve(__dirname,'../services/mobilidadeCalculo.js'),'utf8');
  assert.doesNotMatch(calc,/validacao:/);
});
