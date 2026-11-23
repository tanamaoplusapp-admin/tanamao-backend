'use strict';
const trust=require('mongoose').trusted;
const Profile=require('../models/MobilidadePerfil');
const Profissional=require('../models/Profissional');
const Pagamento=require('./mobilidadePagamento');
const {possuiProfissaoMotorista}=require('./mobilidadeProfissao');
const {compativel}=require('./mobilidadePreferencias');
const {betaAllowed}=require('../config/mobilidade');
const User=require('../models/user');
const Vehicle=require('../models/MobilidadeVeiculo');
const Job=require('../models/MobilidadeSolicitacao');
const {kilometers,validCnh,validVehicle,cnhSupportsVehicle}=require('./mobilidadeCalculo');
const PoliticaMoto=require('./mobilidadePoliticaMoto');
const {emit}=require('./mobilidadeSocket');
const {enviarPushParaUsuario}=require('./pushService');
const LIMIT=Math.min(100,Math.max(1,Number(process.env.MOBILITY_MAX_PICKUP_KM)||25));
const OFFER_SECONDS=25;
const MAX_ATTEMPTS=12;
const recentDate=()=>new Date(Date.now()-120*1000);
async function dispatchOne(app,jobId){
 const job=await Job.findById(jobId).lean();
 if(!job||job.status!=='procurando'||job.tentativas>=MAX_ATTEMPTS||!betaAllowed(job.clienteId))return null;
 // No offer may be issued if the origin permission is pending, restricted or expired.
 if(job.servico==='corrida_moto'&&!(await PoliticaMoto.consultar(job.origem)).permitida)return null;
 const profiles=await Profile.find({status:'aprovado',online:true,emViagemId:null,servicosAprovados:job.servico,servicosAtivos:job.servico,ultimaLocalizacaoEm:trust({$gte:recentDate()}),userId:trust({$nin:job.ignorados||[]}),localizacao:trust({$near:{$geometry:{type:'Point',coordinates:[job.origem.lng,job.origem.lat]},$maxDistance:LIMIT*1000}})}).limit(200).lean();
 // Somente prestadores que aceitam a forma de pagamento escolhida pelo cliente.
 const forma=Pagamento.validarForma(job.pagamento?.metodo);
 const professionals=await Profissional.find({_id:trust({$in:profiles.map(p=>p.profissionalId)}),[Pagamento.CAMPOS[forma]]:true}).select('_id profissaoNome profissoes profissoesDetalhadas').lean();
 const methodEnabled=new Set(professionals.filter(possuiProfissaoMotorista).map(p=>String(p._id)));
 // Mesma regra de acesso por plano usada na descoberta dos demais prestadores.
 const accessRows=await User.find({_id:trust({$in:profiles.map(p=>p.userId)}),acessoExpiraEm:trust({$gt:new Date()}),status:trust({$ne:'blocked'}),subscriptionStatus:trust({$nin:['overdue','blocked']})}).select('_id genero preferenciaAtendimento').lean();
 const accessEnabled=new Map(accessRows.map(u=>[String(u._id),u]));
 const candidates=profiles.filter(p=>betaAllowed(p.userId)&&methodEnabled.has(String(p.profissionalId))&&accessEnabled.has(String(p.userId))&&compativel(job,accessEnabled.get(String(p.userId)))&&validCnh(p)&&p.localizacao?.coordinates?.length===2).map(p=>({p,km:kilometers({lat:p.localizacao.coordinates[1],lng:p.localizacao.coordinates[0]},job.origem)})).filter(x=>x.km<=LIMIT).sort((a,b)=>a.km-b.km);
 for(const {p,km} of candidates){
  const vehicle=await Vehicle.findOne({_id:p.veiculoAtivoId,userId:p.userId}).lean();
  if(!cnhSupportsVehicle(p.cnh.categoria,vehicle?.tipo)||!validVehicle(vehicle,job.servico,job.passageiros,job.carga,job.tipoVeiculo))continue;
  // Compare-and-swap: uma unica oferta por solicitacao, mesmo com dois workers.
  const updated=await Job.findOneAndUpdate({_id:job._id,status:'procurando',tentativas:trust({$lt:MAX_ATTEMPTS})},{$set:{status:'ofertada',ofertaMotoristaId:p.userId,ofertaVeiculoId:vehicle._id,ofertaExpiraEm:new Date(Date.now()+OFFER_SECONDS*1000)},$inc:{tentativas:1}},{new:true});
  if(!updated)return null;
  emit(app,p.userId,'oferta:nova',{id:String(job._id),servico:job.servico,origem:job.origem,destino:job.destino,precoCentavos:job.valorCentavos,distanciaAteColetaKm:Math.round(km*100)/100,expiraEm:updated.ofertaExpiraEm});
  // Reutiliza Firebase Push do backend atual; a oferta tambem fica disponivel por GET.
  // O push nao contem endereco, telefone ou dados pessoais do passageiro.
  Promise.resolve().then(()=>enviarPushParaUsuario(p.userId,{title:'Nova solicitacao Tanamao+',body:'Uma viagem ou entrega esta disponivel. Abra o app para responder.',type:'MOBILIDADE_OFERTA',data:{mobilidadeSolicitacaoId:String(job._id),expiraEm:updated.ofertaExpiraEm.toISOString()}})).catch(e=>console.warn('[mobilidade] push nao entregue:',e.message));
  emit(app,job.clienteId,'solicitacao:status',{id:String(job._id),status:'ofertada'});
  return updated;
 }
 return null;
}
async function redispatch(app){
 const now=new Date();
 const cutoff=new Date(Date.now()-10*60000);
 const timedOut=await Job.find({status:trust({$in:['procurando','ofertada']}),createdAt:trust({$lt:cutoff})}).limit(30).lean();
 for(const job of timedOut){const updated=await Job.findOneAndUpdate({_id:job._id,status:trust({$in:['procurando','ofertada']})},{$set:{status:'sem_motorista',ofertaMotoristaId:null,ofertaVeiculoId:null,ofertaExpiraEm:null,'pagamento.status':'cancelado'}},{new:true});if(updated){emit(app,job.clienteId,'solicitacao:status',{id:String(job._id),status:'sem_motorista'});if(job.ofertaMotoristaId)emit(app,job.ofertaMotoristaId,'oferta:cancelada',{id:String(job._id)});}}
 const expired=await Job.find({status:'ofertada',ofertaExpiraEm:trust({$lte:now})}).limit(50).lean();
 for(const job of expired){
  const updated=await Job.findOneAndUpdate({_id:job._id,status:'ofertada',ofertaMotoristaId:job.ofertaMotoristaId,ofertaExpiraEm:trust({$lte:now})},{$set:{status:'procurando',ofertaMotoristaId:null,ofertaVeiculoId:null,ofertaExpiraEm:null},$addToSet:{ignorados:job.ofertaMotoristaId}},{new:true});
  if(updated){emit(app,job.ofertaMotoristaId,'oferta:expirada',{id:String(job._id)});await dispatchOne(app,job._id);}
 }
 const open=await Job.find({status:'procurando',tentativas:trust({$lt:MAX_ATTEMPTS})}).sort({createdAt:1}).limit(35).lean();
 for(const job of open)await dispatchOne(app,job._id);
}
function start(app){if(process.env.MOBILITY_MODULE_ENABLED!=='true')return;
 let running=false;const timer=setInterval(async()=>{if(running)return;running=true;try{await redispatch(app);}catch(e){console.error('[mobilidade redispatch]',e.message)}finally{running=false;}},15000);timer.unref?.();return()=>clearInterval(timer);
}
module.exports={dispatchOne,redispatch,start};
