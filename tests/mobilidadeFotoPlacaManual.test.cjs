'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function controladorAdmin({temCrlv=false,temFoto=false,proprietarioTerceiro=false}={}){
 const veiculo={_id:'veiculo1',userId:'pessoa1',tipo:'carro',placa:'ABC1D23',crlvValidade:new Date('2030-12-31'),dadosAtualizadosEm:new Date('2026-01-01'),status:'pendente',proprietarioTerceiro,async save(){return this}};
 const chamadas=[];
 const mods={
   mongoose:{trusted:x=>x},
   '../models/MobilidadeVeiculo':{findById:async()=>veiculo},
   '../models/MobilidadeDocumento':{exists:async q=>{chamadas.push(q);return q.tipo==='crlv'?temCrlv:q.tipo==='foto_frente_placa'?temFoto:false}},
   '../models/MobilidadePerfil':{findOne:async()=>null},
   '../middleware/mobilidade':{id:v=>v,error:(status,msg)=>{let err=new Error(msg);err.status=status;throw err},audit:async()=>{}},
   '../services/mobilidadeSocket':{emit:()=>{}},
 };
 const location=path.resolve(__dirname,'../controllers/mobilidadeAdminController.js');
 const text=fs.readFileSync(location,'utf8');
 const mod={exports:{}};
 const load=name=>Object.prototype.hasOwnProperty.call(mods,name)?mods[name]:{};
 const fn=vm.runInThisContext(`(function(require,module,exports){${text}\n})`,{filename:location});
 fn(load,mod,mod.exports);
 const request=async({placaConferida=false,decisao='aprovar'}={})=>{
  const req={params:{vehicleId:veiculo._id},body:{decisao,placaConferida,motivo:decisao==='aprovar'?'':'Documento insuficiente'},userId:'admin1',app:{}};
  let reply;
  await mod.exports.reviewVehicle(req,{json:r=>{reply=r;return r;}});
  return reply;
 };
 return {request,veiculo,chamadas};
}

test('nenhum veículo é aprovado sem o CRLV, ainda que exista foto e confirmação',async()=>{
 const c=controladorAdmin({temFoto:true});
 await assert.rejects(c.request({placaConferida:true}),{status:409});
 assert.equal(c.veiculo.status,'pendente');
});
test('nenhum veículo é aprovado sem foto frontal com placa',async()=>{
 const c=controladorAdmin({temCrlv:true});
 await assert.rejects(c.request({placaConferida:true}),{status:409});
 assert.equal(c.veiculo.status,'pendente');
});
test('não basta enviar os arquivos: aprovação humana explícita é necessária',async()=>{
 const c=controladorAdmin({temCrlv:true,temFoto:true});
 await assert.rejects(c.request(),{status:409});
 assert.equal(c.veiculo.status,'pendente');
});
test('foto e CRLV conferidos manualmente permitem aprovação mesmo no nome de terceiro',async()=>{
 const c=controladorAdmin({temCrlv:true,temFoto:true,proprietarioTerceiro:true});
 const r=await c.request({placaConferida:true});
 assert.equal(r.status,'aprovado');
 assert.equal(c.veiculo.proprietarioTerceiro,true);
 assert.equal(c.veiculo.placaConferidaPor,'admin1');
 assert.ok(c.veiculo.placaConferidaEm instanceof Date);
 assert.equal(c.chamadas.find(c=>c.tipo==='foto_frente_placa')?.mime?.$in?.length,2);
});
test('reprovação limpa a confirmação anterior da placa',async()=>{
 const c=controladorAdmin({temCrlv:true,temFoto:true});
 await c.request({placaConferida:true});
 await c.request({decisao:'reprovar'});
 assert.equal(c.veiculo.status,'reprovado');
 assert.equal(c.veiculo.placaConferidaEm,undefined);
});

test('cidades novas ficam pendentes e não se autorizam automaticamente',()=>{
 const location=path.resolve(__dirname,'../services/mobilidadePoliticaMoto.js');
 // Usa a fonte original instalada: a correção não substitui esta política.
 const policy=fs.readFileSync(location,'utf8');
 assert.match(policy,/status:known\?'restrito':'pendente'/);
 assert.match(policy,/if\(status==='autorizado'&&body\?\.confirmouAnalise!==true\)/);
 assert.match(policy,/const permitida=!globallyOff && !expired && record.status==='autorizado'/);
});

test('upload de foto frontal exige vínculo ao veículo e tipo imagem, não PDF',()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../controllers/mobilidadeController.js'),'utf8');
 assert.match(code,/\['crlv','rntrc','foto_frente_placa','foto_traseira_placa'\]\.includes\(tipo\)/);
 assert.match(code,/\['foto_frente_placa','foto_traseira_placa'\]\.includes\(tipo\)/);
 assert.match(code,/status:'pendente',motivo:'Documento ou foto alterado/);
});
test('cadastro comum exige aprovação explícita para trabalhar',()=>{
 const profile=fs.readFileSync(path.resolve(__dirname,'../models/MobilidadePerfil.js'),'utf8');
 const vehicle=fs.readFileSync(path.resolve(__dirname,'../models/MobilidadeVeiculo.js'),'utf8');
 const dispatch=fs.readFileSync(path.resolve(__dirname,'../services/mobilidadeCandidatos.js'),'utf8');
 assert.match(profile,/default:'incompleto'/);
 assert.match(vehicle,/default:'pendente'/);
 assert.match(dispatch,/if \(!veiculo\.placaConferidaEm\) return false/);
});
