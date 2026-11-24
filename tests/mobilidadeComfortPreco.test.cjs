'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../services/mobilidadeComfort.js'),'utf8');
function carregar(env={}){
  const module={exports:{}};
  const ctx={module,exports:module.exports,Date,Number,Math,Boolean,process:{env},require(nome){
    if(nome.endsWith('/MobilidadePerfil')||nome.endsWith('/MobilidadeVeiculo'))return {};
    if(nome==='./mobilidadeCalculo')return {kilometers:()=>0};
    throw new Error('Import nao esperado: '+nome);
  }};
  vm.runInNewContext(src,ctx,{filename:'mobilidadeComfort.js'});
  return module.exports;
}
test('Comfort desativado ate habilitacao operacional',()=>{
 const cfg=carregar();
 assert.equal(cfg.configurado(),false);
 assert.equal(cfg.taxaComfort(),25);
});
test('habilitado: Comfort tem 25% a mais que Normal, sem inventar nova tarifa',()=>{
 const cfg=carregar({MOBILITY_COMFORT_ENABLED:'true'});
 assert.equal(cfg.configurado(),true);
 assert.equal(cfg.adicionalComfort(1300),325);
 assert.equal(cfg.adicionalComfort(890),223);
});
test('permite configuracao explicita de percentual e bloqueia valores fora do limite',()=>{
 assert.equal(carregar({MOBILITY_COMFORT_ENABLED:'true',MOBILITY_COMFORT_MARKUP_PERCENT:'30'}).adicionalComfort(1000),300);
 assert.equal(carregar({MOBILITY_COMFORT_ENABLED:'true',MOBILITY_COMFORT_MARKUP_PERCENT:'90'}).configurado(),false);
});
test('Comfort so pode ser oferecido com veiculo aprovado manualmente e elegivel',()=>{
 const cfg=carregar({MOBILITY_COMFORT_ENABLED:'true'});
 const v={tipo:'carro',status:'aprovado',confortoAprovado:true,lugares:5,ano:new Date().getFullYear()};
 assert.equal(cfg.veiculoComfort(v),true);
 assert.equal(cfg.veiculoComfort({...v,confortoAprovado:false}),false);
 assert.equal(cfg.veiculoComfort({...v,status:'pendente'}),false);
 assert.equal(cfg.veiculoComfort({...v,tipo:'moto'}),false);
 assert.equal(cfg.veiculoComfort({...v,ano:2010}),false);
});
