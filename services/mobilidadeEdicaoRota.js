'use strict';
const mongoose=require('mongoose');
const {randomUUID}=require('node:crypto');
const Job=require('../models/MobilidadeSolicitacao');
const Profile=require('../models/MobilidadePerfil');
const {id,error,audit}=require('../middleware/mobilidade');
const calc=require('./mobilidadeCalculo');
const R=require('./mobilidadeParadasRegras');
const {validarLocalidade}=require('./mobilidadeGeocoding');
const PoliticaMoto=require('./mobilidadePoliticaMoto');
const {emit}=require('./mobilidadeSocket');
const {enviarPushParaUsuario}=require('./pushService');
const {approximateEnabled}=require('../config/mobilidade');
const trust=mongoose.trusted;
const active=['aceita','no_local','em_andamento'];
const own=req=>id(req.userId||req.user?._id);
const rev=j=>j.versaoRota||0;
const filtroRev=j=>rev(j)?{versaoRota:rev(j)}:{$or:[{versaoRota:0},{versaoRota:trust({$exists:false})}]};
const safeJob=j=>{const x=j.toObject?j.toObject():{...j};for(const k of ['tarifaCongelada','marcoCobranca','alteracaoPendente','historicoAlteracoes','codigoInicioCriptografado','codigoConclusaoCriptografado'])delete x[k];return x;};
async function jobCliente(req){
 const j=await Job.findOne({_id:id(req.params.jobId),clienteId:own(req)}).select('+tarifaCongelada +marcoCobranca +alteracaoPendente').lean();
 if(!j)error(404,'Corrida não encontrada.');
 if(!active.includes(j.status)||!j.motoristaId||!['corrida_carro','corrida_moto'].includes(j.servico)||j.pagamento?.status!=='pendente')error(409,'A edição está disponível durante uma corrida de passageiros aceita e ainda não finalizada.');
 if(!j.motoristaSuportaParadas)error(409,'O motorista precisa usar a versão com edição de trajeto.');
 if(!j.tarifaCongelada)error(409,'Esta corrida foi criada antes da atualização de paradas. A edição está disponível nas novas corridas.');
 return j;
}
async function gpsMotorista(j){
 const p=await Profile.findOne({userId:j.motoristaId}).select('localizacao ultimaLocalizacaoEm emViagemId').lean();
 const xy=p?.localizacao?.coordinates,age=Date.now()-new Date(p?.ultimaLocalizacaoEm||0).getTime();
 if(!Array.isArray(xy)||xy.length!==2||!xy.every(Number.isFinite)||Math.abs(xy[1])>90||Math.abs(xy[0])>180||!Number.isFinite(age)||age>60000||age< -10000||String(p.emViagemId)!==String(j._id))error(409,'Aguarde a atualização do GPS do motorista para alterar a rota.');
 return {lat:xy[1],lng:xy[0]};
}
function samePoint(a,b){return R.same(a,b)&&a.endereco===b.endereco&&calc.norm(a.cidade)===calc.norm(b.cidade)&&a.uf===b.uf&&a.pais===b.pais;}
async function validarNovos(j,paradas,destino,raw){
 const conhecidos=[...(j.paradas||[]),j.destino];
 const novos=[...paradas,destino];const raws=[...(raw.paradas||[]),raw.destino];
 await Promise.all(novos.map((p,i)=>conhecidos.some(q=>samePoint(p,q))?null:validarLocalidade(p,raws[i]?.validacao)));
 if(j.servico==='corrida_moto'){
  if(!(await PoliticaMoto.consultar(j.origem)).permitida)error(403,'Corrida de moto não autorizada nesta origem.');
  if(novos.some(p=>calc.scope(j.origem,p)!=='frete_local'||p.pais!==j.origem.pais))error(400,'Alterações de trajeto de moto devem ficar na cidade do embarque.');
 }
}
async function previa(req,res){
 const j=await jobCliente(req),body=req.body||{},n=j.paradasConcluidas||0;
 // A interface envia apenas as paradas ainda não visitadas; as concluídas são imutáveis.
 const restantes=R.lista(body.paradas,calc.point,j.servico),destino=calc.point(body.destino);
 if(n+restantes.length>R.MAX_PARADAS)error(400,'O limite é de três paradas por corrida, incluindo as concluídas.');
 const antigas=R.restante(j);
 if(samePoint(destino,j.destino)&&antigas.length===restantes.length&&antigas.every((p,i)=>samePoint(p,restantes[i])))error(400,'Altere o destino ou uma parada para recalcular.');
 await validarNovos(j,restantes,destino,body);
 const completas=(j.paradas||[]).slice(0,n),paradas=[...completas,...restantes];
 let marco=null,from=j.origem,percorrido={km:0,min:0,method:'google_routes'};
 if(j.status==='em_andamento'){
  from=await gpsMotorista(j);
  const anterior=j.marcoCobranca||{ponto:j.origem,indice:0,percorrido};
  const novoTrecho=await R.percurso([anterior.ponto,...completas.slice(anterior.indice),from],calc.route,calc.kilometers,{permitirIguais:true});
  percorrido=R.somar(anterior.percorrido,novoTrecho);
  marco={ponto:from,indice:n,percorrido};
 }
 // Valida pontos consecutivos; primeiro trecho pode ter distância zero (motorista já no local).
 R.validarSequencia([...restantes,destino],calc.kilometers);
 const rotaRestante=await R.percurso([from,...restantes,destino],calc.route,calc.kilometers,{permitirIguais:j.status==='em_andamento'});
 const rota=R.somar(percorrido,rotaRestante);
 if(rota.km>4000)error(400,'Distância muito grande.');
 if(rota.method==='aproximacao'&&!approximateEnabled())error(503,'Rota real indisponível.');
 const precos=R.precificar(j.tarifaCongelada,rota.km,rota.min,calc.price,j.carga);
 const alteracao={id:randomUUID(),expiraEm:new Date(Date.now()+90000),status:j.status,versao:rev(j),dados:{paradas,destino,distanciaKm:rota.km,duracaoMin:rota.min,metodoRota:rota.method,...precos,marcoCobranca:marco}};
 const saved=await Job.updateOne({_id:j._id,clienteId:own(req),status:j.status,...filtroRev(j)},{$set:{alteracaoPendente:alteracao}});
 if(!saved.matchedCount)error(409,'A corrida foi atualizada. Abra a edição novamente.');
 res.set('Cache-Control','private, no-store');
 res.json({ok:true,previa:{id:alteracao.id,expiraEm:alteracao.expiraEm,valorAnteriorCentavos:j.valorCentavos,valorCentavos:precos.valorCentavos,diferencaCentavos:precos.valorCentavos-j.valorCentavos,distanciaKm:rota.km,duracaoMin:rota.min,metodoRota:rota.method}});
}
function aviso(req,j,tipo){
 const data={id:String(j._id),status:j.status,rotaAlterada:true,versaoRota:rev(j)};
 emit(req.app,j.clienteId,'viagem:atualizada',data);emit(req.app,j.motoristaId,'viagem:atualizada',data);
 Promise.resolve().then(()=>audit(req,tipo,j._id)).catch(e=>console.warn('[mobilidade/rota] auditoria',e.message));
}
async function confirmar(req,res){
 const j=await jobCliente(req),p=j.alteracaoPendente;
 if(!p||typeof req.body?.previaId!=='string'||p.id!==req.body.previaId||p.status!==j.status||p.versao!==rev(j)||new Date(p.expiraEm)<=new Date())error(409,'O novo preço expirou ou a viagem mudou. Calcule novamente.');
 if(p.dados.metodoRota==='aproximacao'&&!approximateEnabled())error(409,'Calcule uma rota válida novamente.');
 if(j.status==='em_andamento'){
  const now=await gpsMotorista(j);if(calc.kilometers(now,p.dados.marcoCobranca.ponto)>0.3)error(409,'O motorista avançou no trajeto. Calcule o valor novamente.');
 }
 const updated=await Job.findOneAndUpdate({_id:j._id,clienteId:own(req),status:j.status,...filtroRev(j),'alteracaoPendente.id':p.id,'alteracaoPendente.expiraEm':trust({$gt:new Date()})},{$set:p.dados,$unset:{alteracaoPendente:1},$inc:{versaoRota:1},$push:{historicoAlteracoes:{$each:[{em:new Date(),valorAnteriorCentavos:j.valorCentavos,valorNovoCentavos:p.dados.valorCentavos,destinoAnterior:j.destino,destinoNovo:p.dados.destino,paradasAnteriores:j.paradas||[],paradasNovas:p.dados.paradas}],$slice:-20}}},{new:true});
 if(!updated)error(409,'A corrida mudou. Calcule novamente.');
 aviso(req,updated,'viagem.rota_alterada');
 Promise.resolve().then(()=>enviarPushParaUsuario(j.motoristaId,{title:'Rota da corrida atualizada',body:'O passageiro alterou o destino ou as paradas. Confira o novo trajeto e valor.',type:'MOBILIDADE_ROTA_ALTERADA',data:{mobilidadeSolicitacaoId:String(j._id),destinatarioTipo:'profissional'}})).catch(e=>console.warn('[mobilidade/rota] push',e.message));
 res.json({ok:true,solicitacao:safeJob(updated)});
}
async function concluirParada(req,res){
 const j=await Job.findOne({_id:id(req.params.jobId),motoristaId:own(req),status:'em_andamento'}).lean();
 if(!j)error(409,'Corrida em andamento não encontrada.');
 const n=j.paradasConcluidas||0,alvo=R.restante(j)[0];
 if(!alvo)error(409,'Não há paradas pendentes.');
 if(req.body?.versaoRota!==rev(j))error(409,'A rota mudou. Atualize a tela antes de confirmar a parada.');
 const pos=await gpsMotorista(j);
 if(calc.kilometers(pos,alvo)>0.25)error(409,'Aproxime-se da parada antes de confirmá-la.');
 const updated=await Job.findOneAndUpdate({_id:j._id,motoristaId:own(req),status:'em_andamento',...filtroRev(j)},{$set:{paradasConcluidas:n+1},$inc:{versaoRota:1},$unset:{alteracaoPendente:1}},{new:true});
 if(!updated)error(409,'A rota mudou. Atualize a corrida.');
 aviso(req,updated,'viagem.parada_concluida');res.json({ok:true,solicitacao:safeJob(updated)});
}
module.exports={previa,confirmar,concluirParada};
