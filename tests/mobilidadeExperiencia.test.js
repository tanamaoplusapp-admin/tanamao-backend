'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
function load(rel,mocks={}){
 const mod={exports:{}};
 const fn=vm.runInThisContext(`(function(require,module,exports,process){\n${fs.readFileSync(path.join(base,rel),'utf8')}\n})`,{filename:rel});
 fn(n=>{if(n in mocks)return mocks[n];throw Error(`Dependencia nao simulada: ${n}`);},mod,mod.exports,process);
 return mod.exports;
}
const distancia=(a,b)=>{
 const lat=(a.lat-b.lat)*111,lon=(a.lng-b.lng)*103;
 return Math.hypot(lat,lon);
};
const dinamica=load('services/mobilidadeDinamica.js',{
 mongoose:{trusted:q=>q},'../models/MobilidadeSolicitacao':{},'../models/MobilidadePerfil':{},
 './mobilidadeCalculo':{kilometers:distancia}
});
const chat=load('services/mobilidadeChatRapido.js');
const seed=load('services/mobilidadeTarifasIniciais.js');
test('preco base sem demanda ou com poucos pedidos',()=>{
 assert.equal(dinamica.fatorDinamico(0,0),1);
 assert.equal(dinamica.fatorDinamico(2,0),1);
 assert.equal(dinamica.fatorDinamico(3,5),1);
});
test('preco dinamico limitado, com fator visivel e sem valores negativos',()=>{
 const f=dinamica.fatorDinamico(12,2);
 assert.ok(f>1&&f<=1.5);
 assert.equal(dinamica.precificar(1000,1),1000);
 assert.equal(dinamica.precificar(1000,1.5),1500);
 assert.throws(()=>dinamica.precificar(1000,1.8));
});
test('mapa de maior demanda agrega apenas areas com 3 ou mais corridas recentes',()=>{
 const agora=new Date();
 const job=(lat,lng)=>({status:'procurando',createdAt:agora,origem:{lat,lng},servico:'corrida_carro'});
 const centro={lat:-22.54,lng:-55.72};
 const p=[job(-22.54,-55.72),job(-22.542,-55.72),job(-22.541,-55.718),job(-22.59,-55.79)];
 const areas=dinamica.mapaDemanda(p,[],centro,'corrida_carro');
 assert.equal(areas.length,1);
 assert.equal(areas[0].solicitacoes,3);
 assert.ok(Math.abs(areas[0].latitude-centro.lat)<0.02);
 assert.equal(JSON.stringify(areas).includes('endereco'),false);
});
test('atalhos de chat nunca incluem dados pessoais e variam pelo participante',()=>{
 assert.equal(chat.textoRapido('motorista','a_caminho'),'Estou a caminho.');
 assert.equal(chat.textoRapido('cliente','a_caminho'),null);
 assert.equal(chat.textoRapido('cliente','onde_esta'),'Onde voce esta?');
 assert.equal(chat.textoRapido('cliente','codigo_invalido'),null);
});
test('chat permite apenas viagem atribuida e em andamento',()=>{
 assert.equal(chat.podeConversar('ofertada',true),false);
 assert.equal(chat.podeConversar('aceita',false),false);
 assert.equal(chat.podeConversar('aceita',true),true);
 assert.equal(chat.podeConversar('em_andamento',true),true);
 assert.equal(chat.podeConversar('concluida',true),false);
 assert.equal(chat.limparTexto('   Oi\n\n tudo bem?  '),'Oi tudo bem?');
 assert.equal(chat.limparTexto('x'.repeat(600)).length,500);
});
test('tarifas iniciais sao apenas para localidade definida e moto custa menos que carro',()=>{
 const rows=seed.planos();
 assert.equal(rows.length,8);
 assert.ok(rows.every(x=>x.cidade==='ponta pora'&&x.uf==='MS'));
 const by=name=>rows.find(r=>r.servico===name);
 const fare=(x,km,min)=>Math.max(x.minimoCentavos,x.bandeiradaCentavos+km*x.porKmCentavos+min*x.porMinutoCentavos);
 for(const [m,c] of [['corrida_moto','corrida_carro'],['entrega_moto','entrega_carro']]){
  for(const km of [0.5,2,10,35])assert.ok(fare(by(m),km,12)<fare(by(c),km,12));
 }
});
test('contrato de API inclui chat rapido, areas de demanda e preco detalhado',()=>{
 const routes=fs.readFileSync(path.join(base,'routes/mobilidadeRoutes.js'),'utf8');
 const controller=fs.readFileSync(path.join(base,'controllers/mobilidadeController.js'),'utf8');
 assert.match(routes,/motorista\/areas-demanda/);
 assert.match(routes,/mensagens\/rapidas/);
 assert.match(controller,/adicionalDinamicoCentavos/);
 assert.match(controller,/ChatRapido\.podeConversar/);
});
