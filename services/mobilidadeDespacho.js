'use strict';
const trust = require('mongoose').trusted;
const Job = require('../models/MobilidadeSolicitacao');
const { buscarElegiveis } = require('./mobilidadeCandidatos');
const PoliticaMoto=require('./mobilidadePoliticaMoto');
const {emit}=require('./mobilidadeSocket');
const {enviarPushParaUsuario}=require('./pushService');
// O motorista precisa ter tempo para abrir notificacoes com o aparelho bloqueado.
// O app recebe o prazo real em ofertaExpiraEm; nao precisa de nova build.
// Permite ajustar no Render: MOBILITY_OFFER_SECONDS (30 a 120, padrao 75).
const OFFER_SECONDS=Math.min(120,Math.max(30,Math.floor(Number(process.env.MOBILITY_OFFER_SECONDS)||75)));
const MAX_ATTEMPTS=12;
async function dispatchOne(app,jobId){
 const job=await Job.findById(jobId).lean();
 if(!job||job.status!=='procurando'||job.tentativas>=MAX_ATTEMPTS)return null;
 // A busca do cliente e o despacho compartilham a MESMA elegibilidade.
 // Assim, a liberação manual individual não fica online sem receber oferta.
 const candidates = await buscarElegiveis(job);
 for(const {p,km,vehicle} of candidates){
  // Compare-and-swap: uma unica oferta por solicitacao, mesmo com dois workers.
  const updated=await Job.findOneAndUpdate({_id:job._id,status:'procurando',tentativas:trust({$lt:MAX_ATTEMPTS})},{$set:{status:'ofertada',ofertaMotoristaId:p.userId,ofertaVeiculoId:vehicle._id,ofertaExpiraEm:new Date(Date.now()+OFFER_SECONDS*1000)},$inc:{tentativas:1}},{new:true});
  if(!updated)return null;
  emit(app,p.userId,'oferta:nova',{id:String(job._id),servico:job.servico,origem:job.origem,destino:job.destino,precoCentavos:job.valorCentavos,distanciaAteColetaKm:Math.round(km*100)/100,expiraEm:updated.ofertaExpiraEm});
  // Reutiliza Firebase Push do backend atual; a oferta tambem fica disponivel por GET.
  // O push nao contem endereco, telefone ou dados pessoais do passageiro.
  Promise.resolve().then(()=>enviarPushParaUsuario(p.userId,{
    title:job.servico?.startsWith('corrida') ? 'Nova corrida no Tanamão+' : 'Nova solicitação no Tanamão+',
    body:'Você tem uma solicitação. Toque para ver e responder antes que expire.',
    type:'MOBILIDADE_OFERTA',
    data:{
      mobilidadeSolicitacaoId:String(job._id),
      expiraEm:updated.ofertaExpiraEm.toISOString(),
      servico:job.servico,
    },
  })).catch(e=>console.warn('[mobilidade] push nao entregue:',e.message));
  emit(app,job.clienteId,'solicitacao:status',{id:String(job._id),status:'ofertada'});
  return updated;
 }
 return null;
}
async function redispatch(app){
 const now=new Date();
 const maxBuscaMs=Math.min(10*60000,Math.max(60000,Number(process.env.MOBILITY_SEARCH_TIMEOUT_MS)||180000));
 const cutoff=new Date(Date.now()-maxBuscaMs);
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
