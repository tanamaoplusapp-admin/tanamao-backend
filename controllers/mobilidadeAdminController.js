'use strict';
const mongoose=require('mongoose');
const trust=mongoose.trusted;
const Profile=require('../models/MobilidadePerfil');
const Vehicle=require('../models/MobilidadeVeiculo');
const Document=require('../models/MobilidadeDocumento');
const Tariff=require('../models/MobilidadeTarifa');
const Job=require('../models/MobilidadeSolicitacao');
const Audit=require('../models/MobilidadeAuditoria');
const {id,error,audit}=require('../middleware/mobilidade');
const {SERVICES,serviceVehicleCompatible}=require('../config/mobilidade');
const {validCnh,validVehicle,cnhSupportsVehicle,scopeAllowed,norm}=require('../services/mobilidadeCalculo');
const {decrypt}=require('../services/mobilidadeCrypto');
const {emit}=require('../services/mobilidadeSocket');
const Profissional=require('../models/Profissional');
const User=require('../models/user');
const {fotoValida}=require('../services/mobilidadeFoto');
const {possuiProfissaoMotorista}=require('../services/mobilidadeProfissao');
const text=(x,max=500)=>String(x||'').trim().slice(0,max);
const owner=id=>String(id||'');

async function list(req,res){
 const status=text(req.query.status,30);
 const where=status&&['incompleto','em_analise','aprovado','reprovado','suspenso'].includes(status)?{status}:{};
 const page=Math.max(1,Math.min(10000,parseInt(req.query.page,10)||1));
 const [rows,total]=await Promise.all([Profile.find(where).select('-cnh.numeroCriptografado').sort({createdAt:-1}).skip((page-1)*30).limit(30).lean(),Profile.countDocuments(where)]);
 res.json({ok:true,perfis:rows,total,page});
}
async function detail(req,res){
 const p=await Profile.findById(id(req.params.profileId)).select('+cnh.numeroCriptografado').lean();if(!p)error(404,'Perfil nao encontrado');
 const [vehicles,documents,auditRows,usuario]=await Promise.all([Vehicle.find({userId:p.userId}).lean(),Document.find({userId:p.userId}).select('-arquivoId').sort({createdAt:-1}).lean(),Audit.find({alvoId:trust({$in:[p._id]})}).sort({em:-1}).limit(30).lean(),User.findById(p.userId).select('name avatar').lean()]);
 const doc= {...p,cnh:{...p.cnh,numero:p.cnh?.numeroCriptografado?decrypt(p.cnh.numeroCriptografado):null}};delete doc.cnh.numeroCriptografado;
 res.set('Cache-Control','private, no-store');res.json({ok:true,perfil:doc,fotoMotorista:usuario?.avatar||null,nomeMotorista:usuario?.name||null,fotoConfere:!!usuario?.avatar&&usuario.avatar===p.fotoAprovadaUrl,veiculos:vehicles,documentos:documents,auditoria:auditRows});
}
async function reviewCNH(req,res){
 const p=await Profile.findById(id(req.params.profileId)).select('+cnh.numeroCriptografado');if(!p)error(404,'Perfil nao encontrado');
 const choice=req.body?.decisao,reason=text(req.body?.motivo);
 if(!['aprovar','reprovar','solicitar_reenvio'].includes(choice))error(400,'Decisao invalida');
 if(choice!=='aprovar'&&!reason)error(400,'Informe o motivo');
 if(choice==='aprovar'){
  if(!p.cnh?.numeroCriptografado||!p.cnh?.categoria||!p.cnh?.ear||!p.cnh?.validade||new Date(p.cnh.validade)<=new Date())error(409,'CNH, EAR, categoria ou validade insuficiente para aprovacao');
  const document=await Document.exists({userId:p.userId,tipo:'cnh_frente',createdAt:trust({$gte:p.cnh.enviadoEm||new Date(0)})});if(!document)error(409,'Envie documento da CNH antes da aprovacao');
 }
 p.cnh.status=choice==='aprovar'?'aprovado':choice==='reprovar'?'reprovado':'pendente';p.cnh.motivo=reason;p.cnh.avaliadoEm=new Date();p.cnh.avaliadoPor=req.userId;
 p.status=choice==='aprovar'?'em_analise':choice==='reprovar'?'reprovado':'em_analise';p.online=false;p.servicosAtivos=[];p.servicosAprovados=[];
 await p.save();await audit(req,`admin.cnh.${choice}`,p._id,reason);
 emit(req.app,p.userId,'perfil:documentos',{status:p.cnh.status});
 res.json({ok:true,perfilId:p._id,cnhStatus:p.cnh.status,status:p.status});
}
async function reviewVehicle(req,res){
 const v=await Vehicle.findById(id(req.params.vehicleId));if(!v)error(404,'Veiculo nao encontrado');
 const choice=req.body?.decisao,reason=text(req.body?.motivo);
 if(!['aprovar','reprovar','suspender'].includes(choice))error(400,'Decisao invalida');if(choice!=='aprovar'&&!reason)error(400,'Informe o motivo');
 if(choice==='aprovar'){
  const document=await Document.exists({userId:v.userId,veiculoId:v._id,tipo:'crlv',createdAt:trust({$gte:v.dadosAtualizadosEm||new Date(0)})});if(!document)error(409,'Envie o CRLV antes da aprovacao');
  if(v.crlvValidade&&new Date(v.crlvValidade)<=new Date())error(409,'CRLV vencido');
 }
 v.status=choice==='aprovar'?'aprovado':choice==='reprovar'?'reprovado':'suspenso';v.motivo=reason;v.avaliadoEm=new Date();v.avaliadoPor=req.userId;
 await v.save();
 const p=await Profile.findOne({userId:v.userId});if(p){p.online=false;p.servicosAtivos=[];if(choice!=='aprovar'){p.status='em_analise';p.servicosAprovados=[];}await p.save();}
 await audit(req,`admin.veiculo.${choice}`,v._id,reason);
 emit(req.app,v.userId,'veiculo:revisao',{id:String(v._id),status:v.status});
 res.json({ok:true,veiculoId:v._id,status:v.status});
}
async function reviewProfile(req,res){
 const p=await Profile.findById(id(req.params.profileId));if(!p)error(404,'Perfil nao encontrado');
 const choice=req.body?.decisao,reason=text(req.body?.motivo);
 if(!['aprovar','reprovar','suspender','solicitar_reenvio'].includes(choice))error(400,'Decisao invalida');if(choice!=='aprovar'&&!reason)error(400,'Informe o motivo');
 if(choice==='aprovar'){
  const profissional=await Profissional.findById(p.profissionalId).lean();
  if(!possuiProfissaoMotorista(profissional))error(403,'Prestador nao selecionou a profissao Motorista');
  const usuario=await User.findById(p.userId).select('avatar').lean();
  if(!fotoValida(usuario?.avatar))error(409,'Foto do motorista obrigatoria. Solicite o envio de uma foto de rosto antes de aprovar');
  if(!validCnh(p)||!p.cnh.ear)error(409,'CNH aprovada, valida e EAR obrigatorios');
  const services=req.body?.servicosAprovados;
  if(!Array.isArray(services)||!services.length||services.some(x=>!SERVICES.includes(x)||!p.servicosSolicitados.includes(x)))error(400,'Aprove apenas modalidades solicitadas');
  const vehicles=await Vehicle.find({userId:p.userId,status:'aprovado'}).lean();
  for(const code of services){
   if(!scopeAllowed(p,code,{cidade:p.cidadeBase,uf:p.ufBase}))error(403,`Modalidade nao permitida: ${code}`);
   const compatible=vehicles.filter(v=>cnhSupportsVehicle(p.cnh.categoria,v.tipo)&&validVehicle(v,code));
   if(!compatible.length)error(409,`Nao existe veiculo aprovado e CNH compativel para ${code}`);
   if(['frete_interestadual','frete_internacional'].includes(code)){
    const comRNTRC=compatible.filter(v=>v.rntrc);
    if(!comRNTRC.length)error(409,'Frete de longa distancia exige RNTRC e revisao da documentacao, conforme enquadramento aplicavel');
    const doc=await Document.exists({userId:p.userId,veiculoId:trust({$in:comRNTRC.map(v=>v._id)}),tipo:'rntrc'});
    if(!doc)error(409,'Envie comprovante RNTRC para analise manual do frete de longa distancia');
   }
  }
  p.status='aprovado';p.servicosAprovados=[...new Set(services)];p.fotoAprovadaUrl=usuario.avatar;p.motivo='';
 }else{p.status=choice==='suspender'?'suspenso':choice==='reprovar'?'reprovado':'em_analise';p.servicosAprovados=[];}
 p.online=false;p.servicosAtivos=[];p.avaliadoEm=new Date();p.avaliadoPor=req.userId;p.motivo=reason;
 await p.save();await audit(req,`admin.perfil.${choice}`,p._id,reason);
 emit(req.app,p.userId,'perfil:aprovacao',{status:p.status,servicos:p.servicosAprovados});
 res.json({ok:true,perfilId:p._id,status:p.status,servicosAprovados:p.servicosAprovados});
}
async function download(req,res){
 const doc=await Document.findById(id(req.params.documentId));if(!doc)error(404,'Documento nao encontrado');
 if(!mongoose.connection.db)error(503,'MongoDB indisponivel');
 const bucket=new mongoose.mongo.GridFSBucket(mongoose.connection.db,{bucketName:'mobilidadeDocumentosPrivados'});
 const name='documento-'+String(doc._id)+(doc.mime==='application/pdf'?'.pdf':doc.mime==='image/png'?'.png':'.jpg');
 res.set('Content-Type',doc.mime);res.set('Content-Disposition',`attachment; filename="${name}"`);res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
 await audit(req,'admin.documento.visualizado',doc._id,doc.tipo);
 const stream=bucket.openDownloadStream(doc.arquivoId);stream.on('error',err=>{if(!res.headersSent)res.status(404).json({ok:false,erro:'Arquivo indisponivel'});else res.destroy(err);});stream.pipe(res);
}
async function getTariffs(req,res){const tariffs=await Tariff.find({}).sort({servico:1,uf:1,cidade:1}).lean();res.json({ok:true,tarifas:tariffs});}
async function putTariff(req,res){
 const b=req.body||{},servico=text(b.servico,40),uf=text(b.uf||'*',2).toUpperCase(),cidade=norm(b.cidade||'*');
 if(!SERVICES.includes(servico)||!(/^[A-Z]{2}$/.test(uf)||uf==='*')||!cidade||cidade.length>80)error(400,'Tarifa: modalidade, cidade ou UF invalidas');
 const campos=['bandeiradaCentavos','porKmCentavos','porMinutoCentavos','porKgCentavos','porM3Centavos','minimoCentavos'];const numbers={};
 for(const field of campos){const x=Number(b[field]??(['porMinutoCentavos','porKgCentavos','porM3Centavos'].includes(field)?0:NaN));if(!Number.isSafeInteger(x)||x<0||x>10000000)error(400,`Campo ${field} invalido`);numbers[field]=x;}
 if(numbers.bandeiradaCentavos===0&&numbers.porKmCentavos===0&&numbers.porMinutoCentavos===0)error(400,'Configure algum valor real');
 if(typeof b.ativo!=='boolean')error(400,'Informe ativo true/false');
 const tariff=await Tariff.findOneAndUpdate({servico,uf,cidade},{$set:{...numbers,ativo:b.ativo,dinamicaAtiva:b.dinamicaAtiva===true,alteradoPor:req.userId}},{new:true,upsert:true,runValidators:true,setDefaultsOnInsert:true});
 await audit(req,'admin.tarifa.atualizada',tariff._id,`${servico} ${cidade}/${uf}`);res.json({ok:true,tarifa:tariff});
}
async function instalarTarifasIniciais(req,res){
 if(req.body?.confirmacao!=='HOMOLOGAR_TARIFAS')error(400,'Confirme a instalacao de tarifas iniciais');
 const Tarifa=require('../models/MobilidadeTarifa');
 const {planos}=require('../services/mobilidadeTarifasIniciais');
 const rows=[...planos(),...planos({cidade:'pedro juan caballero',uf:'PY'})];let adicionadas=0;
 for(const row of rows){
  const result=await Tarifa.updateOne({servico:row.servico,uf:row.uf,cidade:row.cidade},{$setOnInsert:{...row,alteradoPor:req.userId}},{upsert:true});
  if(result.upsertedCount)adicionadas++;
 }
 await audit(req,'admin.tarifas.iniciais',undefined,`${adicionadas} tarifas criadas sem sobreposicao`);
 res.status(201).json({ok:true,adicionadas,total:rows.length,aviso:'Tarifas ilustrativas. Revise antes de atender clientes reais.'});
}
async function jobs(req,res){const status=text(req.query.status,25);const where=status&&['procurando','ofertada','aceita','no_local','em_andamento','concluida','cancelada','sem_motorista'].includes(status)?{status}:{};res.json({ok:true,solicitacoes:await Job.find(where).sort({createdAt:-1}).limit(100).lean()});}
async function emergencyCancel(req,res){
 const jid=id(req.params.jobId),reason=text(req.body?.motivo);if(!reason)error(400,'Motivo obrigatorio');
 const old=await Job.findOneAndUpdate({_id:jid,status:trust({$nin:['cancelada','concluida','sem_motorista']})},{$set:{status:'cancelada',canceladoEm:new Date(),cancelamentoMotivo:reason,ofertaExpiraEm:null,'pagamento.status':'cancelado'}},{new:true});
 if(!old)error(409,'Solicitacao ja encerrada ou inexistente');
 if(old.motoristaId){await Profile.updateOne({userId:old.motoristaId,emViagemId:old._id},{$set:{emViagemId:null}});emit(req.app,old.motoristaId,'viagem:atualizada',{id:String(jid),status:'cancelada'});}
 if(old.ofertaMotoristaId)emit(req.app,old.ofertaMotoristaId,'oferta:cancelada',{id:String(jid)});
 emit(req.app,old.clienteId,'viagem:atualizada',{id:String(jid),status:'cancelada'});
 await audit(req,'admin.viagem.cancelada',jid,reason);res.json({ok:true,solicitacao:{id:jid,status:'cancelada'}});
}
async function resetPin(req,res){
 const jid=id(req.params.jobId);const row=await Job.findOneAndUpdate({_id:jid,status:trust({$in:['aceita','no_local','em_andamento']})},{$set:{codigoErradoTentativas:0}},{new:true});
 if(!row)error(404,'Viagem ativa nao encontrada');await audit(req,'admin.pin.desbloqueado',jid);res.json({ok:true,id:jid});
}
module.exports={list,detail,reviewCNH,reviewVehicle,reviewProfile,download,getTariffs,putTariff,instalarTarifasIniciais,jobs,emergencyCancel,resetPin};
