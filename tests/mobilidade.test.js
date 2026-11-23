'use strict';
// Testes isolados: executam no Node 20+ sem instalar pacotes ou conectar ao MongoDB.
// Verificam regras de negocio; nao substituem homologacao com a API real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const file = name => path.join(root, name);
function load(source, mocks={}) {
 const full=file(source), mod={exports:{}};
 const requireMock = name => {
  if(Object.prototype.hasOwnProperty.call(mocks,name))return mocks[name];
  if(name.startsWith('node:'))return require(name);
  throw new Error(`Dependencia nao simulada em ${source}: ${name}`);
 };
 const wrapper=vm.runInThisContext(`(function(require,module,exports){\n${fs.readFileSync(full,'utf8')}\n})`,{filename:full});
 wrapper(requireMock,mod,mod.exports);return mod.exports;
}
const config=load('config/mobilidade.js');
const money=load('services/mobilidadePagamento.js',{'../models/Profissional':{}});
const calc=load('services/mobilidadeCalculo.js',{'axios':{post:()=>{throw Error('Sem API externa')}},'../config/mobilidade':config});
const profissao=load('services/mobilidadeProfissao.js');
const preferencias=load('services/mobilidadePreferencias.js');
const periodo=load('services/mobilidadePeriodo.js');
const geocoding=load('services/mobilidadeGeocoding.js',{'axios':{get:async()=>({data:{status:'ZERO_RESULTS'}})},'../config/mobilidade':config});
const id=(number)=>`id_${number}`;
const nearA={lat:-22.54,lng:-55.72,cidade:'Ponta Pora',uf:'MS',endereco:'R. Teste A'};
const nearB={lat:-22.53,lng:-55.71,cidade:'Ponta Pora',uf:'MS',endereco:'R. Teste B'};

test('metodos e preferencia do motorista exatamente iguais aos outros prestadores',()=>{
 assert.deepEqual([...money.FORMAS],['pix','cartao','dinheiro']);
 assert.deepEqual(money.listarFormas({aceitaPix:true,aceitaCartao:false,aceitaDinheiro:true}),['pix','dinheiro']);
 assert.deepEqual(money.listarFormas({aceitaPix:false,aceitaCartao:false,aceitaDinheiro:false}),[]);
 assert.equal(money.aceitaForma({aceitaPix:true},'pix'),true);
 assert.equal(money.aceitaForma({aceitaCartao:false},'cartao'),false);
 assert.equal(money.validarForma(' PIX '),'pix');
 assert.throws(()=>money.validarForma('transferencia'),{status:400});
});

test('mobilidade exige profissao motorista mesmo se houver cadastro profissional',()=>{
 assert.equal(profissao.possuiProfissaoMotorista({profissaoNome:'Motorista (Uber, motouber, entregas)'}),true);
 assert.equal(profissao.possuiProfissaoMotorista({profissoesDetalhadas:[{nome:'Motorista'}]}),true);
 assert.equal(profissao.possuiProfissaoMotorista({profissoes:['Eletricista']}),false);
});

test('cotacao calcula tarifa no servidor e classifica frete local/intermunicipal/interestadual',()=>{
 const countryA={...nearB,cidade:'Dourados'};
 const countryB={...nearB,cidade:'Cascavel',uf:'PR'};
 assert.equal(calc.serviceFor('frete','van',nearA,nearB),'frete_local');
 assert.equal(calc.serviceFor('frete','van',nearA,countryA),'frete_intermunicipal');
 assert.equal(calc.serviceFor('frete','van',nearA,countryB),'frete_interestadual');
 assert.equal(calc.serviceFor('corrida','carro',nearA,nearB),'corrida_carro');
 assert.equal(calc.price({bandeiradaCentavos:500,porKmCentavos:200,porMinutoCentavos:20,minimoCentavos:1200},5,10),1700);
 assert.throws(()=>calc.serviceFor('frete','moto',nearA,nearB),{status:400});
});

function makeDispatch({acceptsCard=true,access=true,driverGenero='feminino',driverPreferencia='todos',clientePreferencia='todos',clienteGenero='feminino'}={}){
 const job={_id:id('job'),status:'procurando',clienteId:id('client'),servico:'corrida_carro',
    origem:nearA,destino:nearB,pagamento:{metodo:'cartao'},clienteGenero,preferenciaMotorista:clientePreferencia,tentativas:0,ignorados:[]};
 const driver={_id:id('profile'),userId:id('user'),profissionalId:id('prof'),status:'aprovado',online:true,emViagemId:null,
   servicosAtivos:['corrida_carro'],servicosAprovados:['corrida_carro'],veiculoAtivoId:id('vehicle'),
   cnh:{categoria:'B',status:'aprovado',validade:new Date(Date.now()+86400000*30)},
   ultimaLocalizacaoEm:new Date(),localizacao:{type:'Point',coordinates:[-55.7201,-22.5401]}};
 let offers=0;
 const db={
  Job:{findById:()=>({lean:async()=>job}),findOneAndUpdate:async()=>{offers++;return {...job,status:'ofertada'};}},
  Profile:{find:()=>({limit:()=>({lean:async()=>[driver]})})},
  Profissional:{find:query=>({select:()=>({lean:async()=>{
    assert.equal(query.aceitaCartao,true);
    return acceptsCard?[{_id:id('prof'),profissaoNome:'Motorista (Uber, fretes, entregas)'}]:[];
  }})})},
  User:{find:()=>({select:()=>({lean:async()=>access?[{_id:id('user'),genero:driverGenero,preferenciaAtendimento:driverPreferencia}]:[]})})},
  Vehicle:{findOne:()=>({lean:async()=>({_id:id('vehicle'),userId:id('user'),tipo:'carro',status:'aprovado',lugares:4,capacidadeKg:100})})},
 };
 const dispatch=load('services/mobilidadeDespacho.js',{
  '../config/mobilidade':config,
  '../models/MobilidadePerfil':db.Profile,'../models/MobilidadeVeiculo':db.Vehicle,
  '../models/MobilidadeSolicitacao':db.Job,'../models/Profissional':db.Profissional,
  '../models/user':db.User,'./mobilidadeCalculo':calc,'./mobilidadePagamento':money,'./mobilidadeProfissao':profissao,
  'mongoose':{trusted:x=>x},'./mobilidadeFoto':{fotoAprovada:()=>true},
  './mobilidadeSocket':{emit:()=>{}},'./pushService':{enviarPushParaUsuario:async()=>true},'./mobilidadePreferencias':preferencias
 });
 return {dispatch,getOffers:()=>offers,job};
}

test('despacho nega motorista que nao aceita cartao',async()=>{
 const t=makeDispatch({acceptsCard:false});
 assert.equal(await t.dispatch.dispatchOne({get:()=>null},t.job._id),null);
 assert.equal(t.getOffers(),0);
});
test('despacho nega motorista com plano profissional expirado',async()=>{
 const t=makeDispatch({access:false});
 assert.equal(await t.dispatch.dispatchOne({get:()=>null},t.job._id),null);
 assert.equal(t.getOffers(),0);
});
test('despacho envia uma oferta se metodo, modalidade, plano, CNH e veiculo forem validos',async()=>{
 const t=makeDispatch();
 const result=await t.dispatch.dispatchOne({get:()=>null},t.job._id);
 assert.equal(result.status,'ofertada');
 assert.equal(t.getOffers(),1);
});

function mockController(){
 let filter=null,change=null,response=null;
 const mocks={
  mongoose:{Types:{ObjectId:class {}},connection:{},mongo:{},trusted:x=>x},
  multer:Object.assign(()=>({single:()=>()=>{}}),{memoryStorage:()=>({})}),
  '../models/MobilidadePerfil':{findOne:async()=>({_id:id('profile'),userId:id('driver'),profissionalId:id('prof')})},
  '../models/MobilidadeVeiculo':{},'../models/MobilidadeDocumento':{},'../models/MobilidadeTarifa':{},
  '../models/MobilidadeCotacao':{},
  '../models/MobilidadeSolicitacao':{findOneAndUpdate:async(f,u)=>{
    filter=f;change=u;
    return {_id:id('job'),clienteId:id('client'),motoristaId:id('driver'),pagamento:{metodo:'pix',status:'informado_recebido'}};
  }},
  '../models/MobilidadeManutencao':{},'../models/MobilidadeMensagem':{},
  '../models/MobilidadeAvaliacao':{},'../models/Avaliacao':{},'../models/Profissional':{},
  '../middleware/mobilidade':{ownedProfessional:async()=>({profile:{},prof:{},owner:id('driver')}),id:x=>x,error:(status,msg)=>{const e=new Error(msg);e.status=status;throw e;},audit:async()=>{}},
  '../config/mobilidade':config,
  '../services/mobilidadeCrypto':{encrypt:x=>x,decrypt:x=>x,pin:()=>123456,comparePin:()=>true},
  '../services/mobilidadeCalculo':calc,
  '../services/mobilidadeDespacho':{dispatchOne:async()=>null},
  '../services/mobilidadePreferencias':preferencias,
  '../services/mobilidadePeriodo':periodo,
  '../services/mobilidadeGeocoding':geocoding,
  '../services/mobilidadeSocket':{emit:()=>{}},
  '../services/mobilidadePagamento':money,
  '../models/user':{},
  '../services/mobilidadeFoto':{fotoAprovada:()=>true,fotoValida:()=>true}
 };
 const c=load('controllers/mobilidadeController.js',mocks);
 const res={json:x=>{response=x;},status:()=>res};
 return {c,res,get:()=>({filter,change,response})};
}

test('somente motorista da viagem concluida pode registrar recebimento',async()=>{
 const t=mockController();
 await t.c.driverPaymentReceived({userId:id('driver'),params:{jobId:id('job')},app:{get:()=>null}},t.res);
 const {filter,change,response}=t.get();
 assert.equal(filter.motoristaId,id('driver'));
 assert.equal(filter.status,'concluida');
 assert.equal(filter['pagamento.status'],'pendente');
 assert.equal(change.$set['pagamento.status'],'informado_recebido');
 assert.equal(response.pagamento.metodo,'pix');
});

test('cliente confirma recebimento declarado e pode contestar',async()=>{
 const t=mockController();
 await t.c.clientPaymentReview({userId:id('client'),params:{jobId:id('job')},body:{decisao:'confirmar'},app:{get:()=>null}},t.res);
 const {filter,change}=t.get();
 assert.equal(filter.clienteId,id('client'));
 assert.equal(filter['pagamento.status'],'informado_recebido');
 assert.equal(change.$set['pagamento.status'],'confirmado_cliente');
 await assert.rejects(()=>t.c.clientPaymentReview({userId:id('client'),params:{jobId:id('job')},body:{decisao:'contestar',observacao:''},app:{get:()=>null}},t.res),{status:400});
});

// Integracao externa: a api nao tem acesso a conta MP ou banco do prestador.
test('nenhuma chamada de cobranca Mercado Pago foi adicionada no modulo',()=>{
 const source=fs.readFileSync(file('controllers/mobilidadeController.js'),'utf8');
 assert.equal(source.includes('mercadopago'),false);
 assert.equal(source.includes('MercadoPago'),false);
 assert.match(source,/diretamente_ao_prestador/);
});


test('preferencia feminina aproveita o perfil existente e nao aceita genero inventado no payload',()=>{
 assert.deepEqual(preferencias.preferenciaParaCotacao({genero:'feminino',preferenciaProfissional:'somente_mulheres'},undefined),{clienteGenero:'feminino',preferenciaMotorista:'somente_mulheres'});
 assert.deepEqual(preferencias.preferenciaParaCotacao({genero:'feminino',preferenciaProfissional:'somente_mulheres'},'todos'),{clienteGenero:'feminino',preferenciaMotorista:'todos'});
 assert.throws(()=>preferencias.preferenciaParaCotacao({genero:'masculino'},'somente_mulheres'),{status:403});
 assert.throws(()=>preferencias.preferenciaParaCotacao({genero:'feminino'},'invalida'),{status:400});
});

test('preferencias devem ser reciprocas; motorista que atende apenas mulheres nao recebe cliente homem',()=>{
 assert.equal(preferencias.compativel({clienteGenero:'feminino',preferenciaMotorista:'somente_mulheres'},{genero:'feminino',preferenciaAtendimento:'todos'}),true);
 assert.equal(preferencias.compativel({clienteGenero:'feminino',preferenciaMotorista:'somente_mulheres'},{genero:'masculino',preferenciaAtendimento:'todos'}),false);
 assert.equal(preferencias.compativel({clienteGenero:'masculino',preferenciaMotorista:'todos'},{genero:'feminino',preferenciaAtendimento:'somente_mulheres'}),false);
});

test('despacho nao oferece uma corrida de passageira que pediu somente mulher a um motorista homem',async()=>{
 const t=makeDispatch({driverGenero:'masculino',clientePreferencia:'somente_mulheres'});
 assert.equal(await t.dispatch.dispatchOne({get:()=>null},t.job._id),null);
 assert.equal(t.getOffers(),0);
});

test('despacho respeita preferencia do motorista para atender somente mulheres',async()=>{
 const t=makeDispatch({driverPreferencia:'somente_mulheres',clienteGenero:'masculino'});
 assert.equal(await t.dispatch.dispatchOne({get:()=>null},t.job._id),null);
 assert.equal(t.getOffers(),0);
});

test('preco usa distancia, duracao, peso e volume de cargas sem criar cobranca da plataforma',()=>{
 const t={bandeiradaCentavos:500,porKmCentavos:200,porMinutoCentavos:20,minimoCentavos:1200,porKgCentavos:7,porM3Centavos:150};
 assert.equal(calc.price(t,5,10,{pesoKg:20,volumeM3:2}),2140);
 assert.equal(calc.price({...t,porKgCentavos:0,porM3Centavos:0},0.5,2),1200);
 assert.throws(()=>calc.price(t,1000000,1000000,{pesoKg:80000,volumeM3:150}),{status:409});
});

test('faturamento do motorista aplica fuso America/Campo_Grande sem dependencias novas',()=>{
 const at=new Date('2026-11-19T18:00:00Z');
 assert.equal(periodo.periodo('hoje',at).inicio.toISOString(),'2026-11-19T04:00:00.000Z');
 assert.equal(periodo.periodo('semana',at).inicio.toISOString(),'2026-11-16T04:00:00.000Z');
 assert.equal(periodo.periodo('mes',at).inicio.toISOString(),'2026-11-01T04:00:00.000Z');
 assert.equal(periodo.periodo('total',at).inicio,null);
 assert.throws(()=>periodo.periodo('nunca',at),{status:400});
});

test('CNH vencida e veiculo nao aprovado nao podem atender; moto transporte inicia bloqueado',()=>{
 assert.equal(calc.validCnh({cnh:{status:'aprovado',validade:new Date(Date.now()+86400000)}}),true);
 assert.equal(calc.validCnh({cnh:{status:'aprovado',validade:new Date(Date.now()-86400000)}}),false);
 assert.equal(calc.validVehicle({tipo:'carro',status:'pendente',lugares:4},'corrida_carro',1),false);
 assert.equal(calc.validVehicle({tipo:'carro',status:'aprovado',lugares:1},'corrida_carro',1),false);
 assert.equal(config.motoPassengerAllowed('Ponta Pora','MS'),false);
});


test('modulo desativado por padrao e permite whitelist beta limitada para testes',()=>{
 const oldEnabled=process.env.MOBILITY_MODULE_ENABLED;
 const oldList=process.env.MOBILITY_BETA_USER_IDS;
 try {
  delete process.env.MOBILITY_MODULE_ENABLED;delete process.env.MOBILITY_BETA_USER_IDS;
  assert.equal(config.enabled(),false);
  assert.equal(config.betaAllowed('qualquer'),true);
  process.env.MOBILITY_BETA_USER_IDS='id_123,id_456';
  assert.equal(config.betaAllowed('id_123'),true);
  assert.equal(config.betaAllowed('id_999'),false);
  assert.equal(config.betaAllowed('id_999','admin'),true);
 } finally {
  if(oldEnabled===undefined)delete process.env.MOBILITY_MODULE_ENABLED;else process.env.MOBILITY_MODULE_ENABLED=oldEnabled;
  if(oldList===undefined)delete process.env.MOBILITY_BETA_USER_IDS;else process.env.MOBILITY_BETA_USER_IDS=oldList;
 }
});


test('sem localidade certificada ou modo beta restrito, bloqueia cotacao de rotas comerciais',async()=>{
 const oldNode=process.env.NODE_ENV,oldBeta=process.env.MOBILITY_BETA_USER_IDS,oldApprox=process.env.MOBILITY_ALLOW_APPROXIMATE_ROUTES;
 try{
  process.env.NODE_ENV='production';delete process.env.MOBILITY_BETA_USER_IDS;
  process.env.MOBILITY_ALLOW_APPROXIMATE_ROUTES='true';
  assert.equal(config.approximateEnabled(),false);
  await assert.rejects(()=>geocoding.validarLocalidade(nearA),{status:503});
  process.env.MOBILITY_BETA_USER_IDS='id_123';
  assert.equal(config.approximateEnabled(),true);
  assert.deepEqual(await geocoding.validarLocalidade(nearA),nearA);
 }finally{
  for(const [k,v] of [['NODE_ENV',oldNode],['MOBILITY_BETA_USER_IDS',oldBeta],['MOBILITY_ALLOW_APPROXIMATE_ROUTES',oldApprox]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});
