const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../controllers/mobilidadeController.js'), 'utf8');
function extract(begin, end) {
  const a=source.indexOf('async function '+begin+'('), b=source.indexOf('async function '+end+'(', a);
  assert(a>=0 && b>a, `function ${begin} not found`);
  return source.slice(a,b);
}
const locCode = extract('setLocation', 'setAvailability');
const avCode = extract('setAvailability', 'getDriverDashboard');
function fail(status, message) {throw Object.assign(new Error(message),{status});}
function fake(manual, overrides={}) {
  const profile={status:'aprovado',liberacaoManual:manual,cnh:{categoria:'B',status:'pendente'},
    veiculoAtivoId:'vehicle-1',servicosAprovados:['corrida_carro'],
    ultimaLocalizacaoEm:new Date(),emViagemId:null,online:false,
    save:async()=>{},...overrides};
  const user={_id:'driver-1',status:'active',subscriptionStatus:'active',acessoExpiraEm:new Date(Date.now()+86400000)};
  const vehicle={_id:'vehicle-1',userId:'driver-1',tipo:'carro',lugares:4,status:'pendente'};
  const services=[];
  const p={findOneAndUpdate:async (where, update)=>({ultimaLocalizacaoEm:update.$set.ultimaLocalizacaoEm})};
  const ownedProfile=async()=>({profile,prof:{}});
  const calc={point:({lat,lng})=>({lat,lng}),validCnh:()=>false,cnhSupportsVehicle:()=>true,validVehicle:()=>true};
  const req={body:{lat:-22,lng:-55,online:true,servicosAtivos:['corrida_carro']}, userId:'driver-1'};
  const res={json:x=>{services.push(x);return x}};
  const User={findById:()=>({select:()=>({lean:async()=>user})})};
  const Vehicle={findOne:()=>({lean:async()=>vehicle})};
  const Pagamento={listarFormas:()=>['pix']};
  const Loc = new Function('calc','ownedProfile','error','Profile','Job','own','emit',`return (${locCode.replace('async function setLocation','async function')})`)
    (calc,ownedProfile,fail,p,{},req=>req.userId,()=>{});
  const Av = new Function('ownedProfile','error','assertIdle','own','Pagamento','User','fotoAprovada','calc','Vehicle','arrayServices','serviceVehicleCompatible',`return (${avCode.replace('async function setAvailability','async function')})`)
    (ownedProfile,fail,()=>{},req=>req.userId,Pagamento,User,()=>false,calc,Vehicle,x=>x, (service,type)=>service==='corrida_carro'&&type==='carro');
  return {Loc,Av,req,res,profile,vehicle,services};
}

test('perfil manual aprovado pode enviar GPS sem CNH aprovada',async()=>{
  const t=fake(true); await t.Loc(t.req,t.res);
  assert.equal(t.services[0].ok,true);
});
test('perfil sem liberacao manual NAO pode enviar GPS sem CNH',async()=>{
  const t=fake(false);await assert.rejects(t.Loc(t.req,t.res),{status:403});
});
test('perfil manual aprovado pode ativar corrida de carro com veiculo pendente',async()=>{
  const t=fake(true);await t.Av(t.req,t.res);assert.equal(t.profile.online,true);
  assert.equal(t.services[0].online,true);
});
test('motorista comum continua sujeito a foto e CNH',async()=>{
  const t=fake(false);await assert.rejects(t.Av(t.req,t.res),{status:403});
});
test('liberacao manual nao permite veiculo suspenso',async()=>{
  const t=fake(true);t.vehicle.status='suspenso';await assert.rejects(t.Av(t.req,t.res),{status:403});
});
test('liberacao manual nao permite perfil suspenso',async()=>{
  const t=fake(true,{status:'suspenso'});await assert.rejects(t.Loc(t.req,t.res),{status:403});
});
test('sem novas alteracoes nas transicoes de viagem sem PIN',()=>{
  assert(source.includes("const startTrip=(req,res)=>tripTransition(req,res,'iniciar');"));
  assert(source.includes('async function motivoOfertaIndisponivel('));
});
