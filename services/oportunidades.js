'use strict';
const mongoose=require('mongoose');const Pedido=require('../models/PedidoAberto');const Prof=require('../models/Profissional');const User=require('../models/user');const Notification=require('../models/Notification');const {sendNotification}=require('./notificationService');const R=require('./oportunidadesRegras');
// Global sanitizeFilter remains enabled. Trust only server-defined operators, never a request object.
const T = operators => mongoose.trusted(operators);
const oid=x=>new mongoose.Types.ObjectId(String(x));
const fields='name role cidade estado genero preferenciaAtendimento preferenciaProfissional receberServicos status statusCadastro perfilAtivo notificacoesAtivas pushEnabled acessoExpiraEm active';
async function user(id){return User.findById(id).select(fields).lean();}
async function profile(id){return Prof.findOne({userId:id}).select('userId name nomeFantasia tipoPrestador profissaoId profissoesDetalhadas endereco tipoAtendimento status statusCadastro online operationalStatus aceitaServicoImediato atendeEmergencia metrics').lean();}
async function eligible(pedido,p,u,client){return R.matches(pedido,p,u,client||await user(pedido.cliente));}
async function candidates(pedido){
 const client=await user(pedido.cliente); if(!R.enabled(client))return [];
 const profiles=await Prof.find({userId:T({$exists:true,$ne:null}),$or:[{profissaoId:pedido.profissaoId},{'profissoesDetalhadas.profissaoId':pedido.profissaoId}]}).select('userId profissaoId profissoesDetalhadas endereco tipoAtendimento status statusCadastro online operationalStatus aceitaServicoImediato atendeEmergencia metrics').lean();
 const local=profiles.filter(p=>(!p.endereco?.cidade&&!p.endereco?.cidadeSlug||R.city(p.endereco?.cidade||p.endereco?.cidadeSlug)===pedido.cidadeSlug)&&(!p.endereco?.estado||R.uf(p.endereco?.estado)===pedido.uf));
 const accounts=await User.find({_id:T({$in:local.map(p=>p.userId)})}).select(fields).lean(); const map=new Map(accounts.map(u=>[R.id(u._id),u]));
 const excluded=new Set((pedido.convidados||[]).map(R.id));
 return local.filter(p=>!excluded.has(R.id(p.userId))&&R.matches(pedido,p,map.get(R.id(p.userId)),client)).sort((a,b)=>R.rank(pedido,b)-R.rank(pedido,a)||R.id(a.userId).localeCompare(R.id(b.userId))).filter((p,i,all)=>all.findIndex(x=>R.id(x.userId)===R.id(p.userId))===i);
}
function event(key,userId,tipo,role,title,message){return {key,userId,tipo,role,title,message,done:false};}
function open(p){return p.status==='aberto'&&new Date(p.expiraEm)>new Date();}
let busy=false,indexed=false;
async function ensureIndexes(){if(indexed)return;await Pedido.createIndexes();await Prof.collection.createIndex({cnpj:1},{unique:true,sparse:true});indexed=true;}
async function tick(){if(busy||mongoose.connection.readyState!==1)return; busy=true;try{
 await ensureIndexes();
 // Mark expired offers without deleting history; do not send old invitations.
 await Pedido.updateMany({status:'aberto',expiraEm:T({$lte:new Date()})},{$set:{status:'expirado'}});
 for(let i=0;i<12;i++){
  const now=new Date();const doc=await Pedido.findOneAndUpdate({$and:[{$or:[{processandoAte:null},{processandoAte:T({$lte:now})}]},{$or:[{status:'aberto',expiraEm:T({$gt:now}),proximaBusca:T({$lte:now})},{eventos:T({$elemMatch:{done:false}})}]}]},{$set:{processandoAte:new Date(Date.now()+180000)}},{new:true,sort:{updatedAt:1}}).lean();if(!doc)break;
  try{
   if(open(doc)&&new Date(doc.proximaBusca)<=now){
    const remaining=Math.max(0,60-(doc.convidados||[]).length);
    const matched=remaining?await candidates(doc):[];const group=matched.slice(0,Math.min(10,remaining));
    const events=group.map(p=>event(`invite:${p.userId}`,p.userId,'PEDIDO_ABERTO_OPORTUNIDADE','profissional','Nova oportunidade de trabalho','Um cliente da sua cidade precisa de um serviço da sua especialidade. Confira e envie sua proposta.'));
    const update={$set:{proximaBusca:new Date(Date.now()+(group.length&&remaining>group.length?5:30)*60000)}};
    if(group.length){update.$addToSet={convidados:{$each:group.map(p=>p.userId)}};update.$push={eventos:{$each:events}};}
    await Pedido.updateOne({_id:doc._id,status:'aberto',expiraEm:T({$gt:new Date()})},update);
   }
   const current=await Pedido.findById(doc._id).lean();
   for(const e of (current.eventos||[]).filter(x=>!x.done).slice(0,30)){
    let send=true; const recipient=await user(e.userId); if(!R.enabled(recipient))send=false;
    if(e.tipo==='PEDIDO_ABERTO_OPORTUNIDADE')send=send&&open(current)&&await eligible(current,await profile(e.userId),recipient);
    if(e.tipo==='PEDIDO_ABERTO_PROPOSTA')send=send&&open(current);
    const key=`${current._id}:${e.key}`;
    if(send&&!(await Notification.exists({userId:e.userId,'payload.eventKey':key}))){
     const n=await sendNotification({userId:e.userId,type:e.tipo,title:e.title,message:e.message,relatedId:current._id,skipPush:recipient.notificacoesAtivas===false,payload:{pedidoAbertoId:String(current._id),destinatarioTipo:e.role,eventKey:key}});
     if(!n)throw Error('Falha ao registrar notificação');
    }
    await Pedido.updateOne({_id:current._id,'eventos.key':e.key},{$set:{'eventos.$.done':true}});
   }
  }catch(err){console.error('[oportunidades.worker]',err.message); await Pedido.updateOne({_id:doc._id},{$set:{processandoAte:new Date(Date.now()+60000)}});continue;}
  await Pedido.updateOne({_id:doc._id},{$set:{processandoAte:null}});
 }
 }catch(e){console.error('[oportunidades.tick]',e.message);}finally{busy=false;}}
function start(){const t=setInterval(tick,15000);t.unref?.();return t;}
module.exports={user,profile,eligible,candidates,event,open,tick,start,oid,ensureIndexes};
