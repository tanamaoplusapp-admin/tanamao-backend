'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function moduleLoad(rel,mocks={},localProcess=process){
 const mod={exports:{}};
 const fn=vm.runInThisContext('(function(require,module,exports,process){\n'+file(rel)+'\n})',{filename:rel});
 fn(name=>{if(Object.prototype.hasOwnProperty.call(mocks,name))return mocks[name];throw Error('Unmocked dependency: '+name);},mod,mod.exports,localProcess);
 return mod.exports;
}
function rules(enabled=true){
 let query=null;
 const T=moduleLoad('services/mobilidadeTeste.js',{
  '../models/MobilidadePerfil':{exists:async q=>{query=q;return {_id:'grant'};}},
  '../config/mobilidade':{serviceVehicleCompatible:(service,type)=>service==='corrida_carro'&&type==='carro'},
 },{env:{MOBILITY_TEST_MODE_ENABLED:enabled?'true':'false'}});
 return {T,getQuery:()=>query};
}
const future=()=>new Date(Date.now()+15*60000);
const demoProfile=()=>({status:'em_analise',liberacaoTeste:{clienteTesteId:'cliente-especifico',veiculoId:'carro1',servicos:['corrida_carro'],expiraEm:future(),revogadaEm:null}});
test('demonstracao desligada por padrao, mesmo com concessao antiga',async()=>{
 const {T}=rules(false);assert.equal(T.ativo(),false);assert.equal(T.perfilEmTeste(demoProfile()),false);
 assert.equal(await T.existeClienteComTeste('cliente-especifico','corrida_carro'),false);
});
test('validade do teste so inclui o cliente nomeado e carro',()=>{
 const {T}=rules(true),p=demoProfile();assert.equal(T.autorizadoPara(p,'cliente-especifico','corrida_carro'),true);
 assert.equal(T.autorizadoPara(p,'outro-cliente','corrida_carro'),false);
 assert.equal(T.autorizadoPara(p,'cliente-especifico','corrida_moto'),false);
 assert.equal(T.autorizadoPara(p,'cliente-especifico','frete_local'),false);
});
test('teste expirado, revogado, suspenso ou reprovado nunca habilita motorista',()=>{
 const {T}=rules(true);const p=demoProfile();
 p.liberacaoTeste.expiraEm=new Date(Date.now()-1000);assert.equal(T.perfilEmTeste(p),false);
 p.liberacaoTeste.expiraEm=future();p.liberacaoTeste.revogadaEm=new Date();assert.equal(T.perfilEmTeste(p),false);
 p.liberacaoTeste.revogadaEm=null;p.status='suspenso';assert.equal(T.perfilEmTeste(p),false);
 p.status='reprovado';assert.equal(T.perfilEmTeste(p),false);
});
test('veiculo de demonstracao so pode ser carro ativo compativel',()=>{
 const {T}=rules(true);const car={tipo:'carro',status:'pendente',lugares:4};
 assert.equal(T.veiculoDemo(car,'corrida_carro',1,'carro'),true);
 assert.equal(T.veiculoDemo({...car,status:'suspenso'},'corrida_carro',1,'carro'),false);
 assert.equal(T.veiculoDemo(car,'corrida_moto',1,'moto'),false);
 assert.equal(T.veiculoDemo({...car,lugares:1},'corrida_carro',1,'carro'),false);
});
test('consulta da conta vinculada exige autorizacao ainda vigente',async()=>{
 const {T,getQuery}=rules(true);assert.equal(await T.existeClienteComTeste('cliente-especifico','corrida_carro'),true);
 const q=getQuery();assert.equal(q['liberacaoTeste.clienteTesteId'],'cliente-especifico');
 assert.ok(q['liberacaoTeste.expiraEm'].$gt instanceof Date);
 assert.equal(q['liberacaoTeste.revogadaEm'],null);
 assert.equal(await T.existeClienteComTeste('cliente-especifico','entrega_moto'),false);
});
const APP=path.resolve(ROOT,'../tana_mao_app/src');
const HAS_APP=fs.existsSync(path.join(APP,'services/mobilidadeDatas.js'));
function dates(){const txt=fs.readFileSync(path.join(APP,'services/mobilidadeDatas.js'),'utf8').replace(/^export /gm,'');
 return vm.runInNewContext(txt+'\n({mascararDataCNH,exibirDataCNH,dataCNHParaISO});');}
test('CNH mascara barras automaticamente digitando apenas numeros',{skip:!HAS_APP},()=>{
 const d=dates();assert.equal(d.mascararDataCNH('3'),'3');assert.equal(d.mascararDataCNH('31'),'31/');
 assert.equal(d.mascararDataCNH('311'),'31/1');assert.equal(d.mascararDataCNH('3112'),'31/12/');
 assert.equal(d.mascararDataCNH('31122028'),'31/12/2028');
 assert.equal(d.mascararDataCNH('31/12/2028'),'31/12/2028');
 assert.equal(d.mascararDataCNH('311220281234'),'31/12/2028');
 assert.equal(d.mascararDataCNH('31','31/'),'3');
 assert.equal(d.mascararDataCNH('31/12','31/12/'),'31/1');
});
test('CNH valida datas verdadeiras e converte para ISO',{skip:!HAS_APP},()=>{
 const d=dates();assert.equal(d.dataCNHParaISO('29/02/2028'),'2028-02-29');
 assert.equal(d.dataCNHParaISO('31/04/2028'),null);
 assert.equal(d.dataCNHParaISO('29/02/2027'),null);
 assert.equal(d.dataCNHParaISO('15/13/2028'),null);
 assert.equal(d.dataCNHParaISO('15/02/28'),null);
 assert.equal(d.exibirDataCNH('2028-12-31T00:00:00.000Z'),'31/12/2028');
});
test('o app aceita PDF exportado e fotos de camera/galeria sem biblioteca nova',{skip:!HAS_APP},()=>{
 const txt=fs.readFileSync(path.join(APP,'screens/profissional/mobilidade/MobCadastroScreen.js'),'utf8');
 assert.match(txt,/File\.pickFileAsync\(undefined, 'application\/pdf'\)/);
 assert.match(txt,/ImagePicker\.launchCameraAsync/);
 assert.match(txt,/ImagePicker\.launchImageLibraryAsync/);
 assert.match(txt,/mascararDataCNH\(valor, atual\)/);
 assert.match(txt,/dataCNHParaISO\(validade\)/);
 assert.match(file('controllers/mobilidadeController.js'),/\['image\/jpeg','image\/png','application\/pdf'\]/);
 assert.match(file('controllers/mobilidadeController.js'),/bytes\.subarray\(0,5\).*'%PDF-'/);
});
test('endpoint da demonstracao usa autenticacao administrativa',()=>{
 const txt=file('routes/mobilidadeAdminRoutes.js');
 assert.match(txt,/r\.use\(guardEnabled,verifyToken,admin\)/);
 assert.match(txt,/r\.post\('\/perfis\/:profileId\/teste',asyncHandler\(c\.controlarTeste\)\)/);
});
test('despacho e busca nunca usam liberacao temporaria em corridas reais',()=>{
 for(const source of ['services/mobilidadeCandidatos.js','services/mobilidadeDespacho.js']){
  const txt=file(source);assert.match(txt,/job\.testeOperacional\s*===\s*true/);
  assert.match(txt,/Teste\.autorizadoPara/);
  assert.match(txt,/status:\s*'aprovado'/);
 }
});
test('simulacoes excluidas do financeiro, do mapa e das avaliacoes',()=>{
 const controller=file('controllers/mobilidadeController.js');
 assert.match(controller,/testeOperacional:\{\$ne:true\}/);
 assert.match(controller,/Viagens de demonstracao nao geram avaliacoes publicas/);
 const dyn=file('services/mobilidadeDinamica.js');assert.match(dyn,/testeOperacional:mongoose\.trusted\(\{\$ne:true\}\)/);
 const DIST=(a,b)=>Math.hypot((a.lat-b.lat)*111,(a.lng-b.lng)*103);
 const D=moduleLoad('services/mobilidadeDinamica.js',{mongoose:{trusted:x=>x},'../models/MobilidadeSolicitacao':{},'../models/MobilidadePerfil':{},'./mobilidadeCalculo':{kilometers:DIST}});
 const pos={lat:-22.54,lng:-55.72},createdAt=new Date();
 const samples=[{origem:pos,status:'procurando',servico:'corrida_carro',createdAt,testeOperacional:true},{origem:pos,status:'procurando',servico:'corrida_carro',createdAt,testeOperacional:true},{origem:pos,status:'procurando',servico:'corrida_carro',createdAt,testeOperacional:true}];
 assert.deepEqual(D.mapaDemanda(samples,[],pos,'corrida_carro'),[]);
});
function fakeAdmin(enabled=true){
 const audits=[],emissions=[];
 const profile={_id:'perfil01',userId:'motorista01',status:'em_analise',profissionalId:'prof01',servicosSolicitados:['corrida_carro'],online:true,servicosAtivos:['corrida_carro'],liberacaoTeste:{},emViagemId:null,save:async function(){this.saved=true;}};
 const vehicle={_id:'carro01',userId:'motorista01',tipo:'carro',status:'pendente',lugares:4};
 let cliente={_id:'cliente01',status:'active'};
 const errors=(status,message)=>{throw Object.assign(new Error(message),{status});};
 const mocks={
  mongoose:{trusted:x=>x},
  '../models/MobilidadePerfil':{findById:async()=>profile},
  '../models/MobilidadeVeiculo':{findOne:()=>({lean:async()=>vehicle})},
  '../models/MobilidadeDocumento':{},'../models/MobilidadeTarifa':{},
  '../models/MobilidadeSolicitacao':{},'../models/MobilidadeAuditoria':{},
  '../middleware/mobilidade':{id:x=>x,error:errors,audit:async(...a)=>audits.push(a)},
  '../config/mobilidade':{SERVICES:['corrida_carro'],serviceVehicleCompatible:()=>true},
  '../services/mobilidadeCalculo':{},'../services/mobilidadeCrypto':{},
  '../services/mobilidadeSocket':{emit:(...a)=>emissions.push(a)},
  '../models/Profissional':{},'../models/user':{findById:()=>({select:()=>({lean:async()=>cliente})})},
  '../services/mobilidadeTeste':{ativo:()=>enabled,veiculoDemo:(v,s)=>!!v&&v.tipo==='carro'&&s==='corrida_carro'&&v.lugares>1},
  '../services/mobilidadeFoto':{},'../services/mobilidadeProfissao':{},
  '../services/mobilidadePoliticaMoto':{},'../models/MobilidadePermissaoMoto':{},
 };
 const controller=moduleLoad('controllers/mobilidadeAdminController.js',mocks);
 const req=(body)=>({params:{profileId:'perfil01'},body,userId:'admin01',app:{}});
 const res={json(data){this.body=data;return this;}};
 return {controller,profile,vehicle,audits,emissions,req,res,setCliente(x){cliente=x;}};
}
test('admin libera motorista somente para corrida de carro, cliente selecionado e expira em ate 60min',async()=>{
 const a=fakeAdmin();const before=Date.now();
 await a.controller.controlarTeste(a.req({acao:'liberar',clienteTesteId:'cliente01',veiculoId:'carro01',minutos:30}),a.res);
 assert.equal(a.res.body.ok,true);assert.equal(a.profile.liberacaoTeste.clienteTesteId,'cliente01');
 assert.equal(a.profile.status,'em_analise');assert.equal(a.profile.online,false);
 assert.deepEqual(a.profile.liberacaoTeste.servicos,['corrida_carro']);
 assert.ok(a.profile.liberacaoTeste.expiraEm.getTime()>=before+30*60000);
 assert.ok(a.profile.liberacaoTeste.expiraEm.getTime()<=Date.now()+30*60000+2000);
 assert.ok(a.audits.some(x=>x[1]==='admin.motorista.teste_liberado'));
});
test('admin pode revogar teste e motorista fica offline',async()=>{
 const a=fakeAdmin();
 await a.controller.controlarTeste(a.req({acao:'liberar',clienteTesteId:'cliente01',veiculoId:'carro01',minutos:15}),a.res);
 await a.controller.controlarTeste(a.req({acao:'revogar'}),a.res);
 assert.ok(a.profile.liberacaoTeste.revogadaEm instanceof Date);
 assert.equal(a.profile.online,false);
 assert.ok(a.audits.some(x=>x[1]==='admin.motorista.teste_revogado'));
});
test('admin nao libera testes sem chave de ambiente ou fora do limite de tempo',async()=>{
 const a=fakeAdmin(false),b=fakeAdmin(true);
 const body={acao:'liberar',clienteTesteId:'cliente01',veiculoId:'carro01',minutos:30};
 await assert.rejects(()=>a.controller.controlarTeste(a.req(body),a.res),{status:403});
 for(const minutos of [0,1,4,61,90,NaN])await assert.rejects(()=>b.controller.controlarTeste(b.req({...body,minutos}),b.res),{status:400});
});
test('admin nao libera conta unica, suspensa, sem carro, ou sem modalidade solicitada',async()=>{
 const b={acao:'liberar',clienteTesteId:'cliente01',veiculoId:'carro01',minutos:30};
 const a=fakeAdmin();
 await assert.rejects(()=>a.controller.controlarTeste(a.req({...b,clienteTesteId:'motorista01'}),a.res),{status:400});
 a.profile.status='suspenso';await assert.rejects(()=>a.controller.controlarTeste(a.req(b),a.res),{status:403});
 a.profile.status='em_analise';a.vehicle.tipo='moto';await assert.rejects(()=>a.controller.controlarTeste(a.req(b),a.res),{status:409});
 a.vehicle.tipo='carro';a.profile.servicosSolicitados=[];
 await assert.rejects(()=>a.controller.controlarTeste(a.req(b),a.res),{status:409});
});
