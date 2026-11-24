'use strict';
const mongoose=require('mongoose');
const trust=mongoose.trusted;
const crypto=require('node:crypto');
const multer=require('multer');
const {Readable}=require('node:stream');
const Profile=require('../models/MobilidadePerfil');
const Vehicle=require('../models/MobilidadeVeiculo');
const Document=require('../models/MobilidadeDocumento');
const Tariff=require('../models/MobilidadeTarifa');
const Quote=require('../models/MobilidadeCotacao');
const Job=require('../models/MobilidadeSolicitacao');
const Maintenance=require('../models/MobilidadeManutencao');
const Message=require('../models/MobilidadeMensagem');
const Dinamica=require('../services/mobilidadeDinamica');
const ChatRapido=require('../services/mobilidadeChatRapido');
const {enviarPushParaUsuario}=require('../services/pushService');
const {notificarClienteEtapa}=require('../services/mobilidadeNotificacoesCliente');
const Comfort=require('../services/mobilidadeComfort');
const Avaliacao=require('../models/Avaliacao');
const AvaliacaoMobilidade=require('../models/MobilidadeAvaliacao');
const {obterReputacaoMotorista}=require('../services/mobilidadeReputacao');
const Profissional=require('../models/Profissional');
const {ownedProfessional,id,error,audit}=require('../middleware/mobilidade');
const {SERVICES,VEHICLES,serviceVehicleCompatible}=require('../config/mobilidade');
const {encrypt}=require('../services/mobilidadeCrypto');
const calc=require('../services/mobilidadeCalculo');
const {dispatchOne}=require('../services/mobilidadeDespacho');
const {documentosAutorizados,veiculoCompativel}=require('../services/mobilidadeCandidatos');
const {emit}=require('../services/mobilidadeSocket');
const Pagamento=require('../services/mobilidadePagamento');
const Preferencias=require('../services/mobilidadePreferencias');
const {periodo:periodoFinanceiro}=require('../services/mobilidadePeriodo');
const {validarLocalidade}=require('../services/mobilidadeGeocoding');
const PoliticaMoto=require('../services/mobilidadePoliticaMoto');
const User=require('../models/user');
const {fotoAprovada,fotoValida}=require('../services/mobilidadeFoto');
const own=req=>id(req.userId||req.user?._id);
const validateDate=value=>{const d=new Date(value);if(!value||Number.isNaN(d.getTime()))error(400,'Data invalida');return d;};
const asText=(x,max=200)=>String(x||'').trim().slice(0,max);
const upper=(x)=>String(x||'').trim().toUpperCase();
function arrayServices(items){if(!Array.isArray(items)||!items.length||items.length>SERVICES.length||items.some(s=>!SERVICES.includes(s)))error(400,'Selecione modalidades validas');return [...new Set(items)];}
async function ownedProfile(req,create=false){
 const {prof,owner}=await ownedProfessional(req);
 let profile=await Profile.findOne({userId:owner});
 if(!profile&&create)profile=await Profile.create({userId:owner,profissionalId:prof._id,servicosSolicitados:[]});
 if(!profile)error(404,'Cadastre suas modalidades de mobilidade');
 return {profile,prof,owner};
}
function assertIdle(profile){if(profile.emViagemId)error(409,'Finalize a viagem em andamento primeiro');}
function publicProfile(profile){const x=profile.toObject?profile.toObject():{...profile};if(x.cnh){delete x.cnh.numeroCriptografado;}return x;}
async function getVehicle(req){const v=await Vehicle.findOne({_id:id(req.params.vehicleId),userId:own(req)});if(!v)error(404,'Veiculo nao encontrado');return v;}

async function catalog(req,res){res.json({ok:true,servicos:SERVICES,veiculos:VEHICLES,formasPagamento:Pagamento.FORMAS,recebimento:'diretamente_ao_prestador',regras:{corridaMotoHabilitadaPorLocalidade:true,aprovacaoCNHManual:true,documentosPrivados:true},categoriaCarro:{normal:true,comfortConfigurado:Comfort.configurado()}});}

// Consulta antecipada pelo ponto de embarque. Usa a mesma verificacao
// de cidade/PAIS que a cotacao para nao confiar na cidade informada pelo cliente.
async function modalidadesOrigem(req,res){
 const origem=calc.point(req.body?.origem);
 await validarLocalidade(origem, req.body?.origem?.validacao);
 const corridaMoto=await PoliticaMoto.consultar(origem);
 const disponivelComfort=await Comfort.disponivelNaOrigem(origem);
 res.set('Cache-Control','private, no-store');
 res.json({ok:true,origem:{cidade:origem.cidade,uf:origem.uf,pais:origem.pais},corridaMoto,categoriaCarro:{normal:true,comfort:disponivelComfort},
  observacao:'Modalidades de entrega e corridas de carro seguem suas proprias regras e aprovacao.'});
}
async function getProfile(req,res){const {profile,prof}=await ownedProfile(req);const [vehicles,usuario]=await Promise.all([Vehicle.find({userId:own(req)}).sort({createdAt:-1}).lean(),User.findById(own(req)).select('avatar').lean()]);res.set('Cache-Control','private, no-store');res.json({ok:true,perfil:publicProfile(profile),veiculos:vehicles,fotoMotorista:usuario?.avatar||null,fotoAprovada:fotoAprovada(profile,usuario),formasPagamento:Pagamento.listarFormas(prof),recebimento:'diretamente_ao_prestador'});}
async function setProfile(req,res){
 const {profile}=await ownedProfile(req,true);assertIdle(profile);
 const services=arrayServices(req.body?.servicosSolicitados);
 const cidade=asText(req.body.cidadeBase,80),uf=upper(req.body.ufBase);
 if(!cidade||!/^[A-Z]{2}$/.test(uf))error(400,'Cidade e UF base obrigatorias');
 // Qualquer mudanca nas habilitacoes exige nova analise; nao confiar na aprovacao antiga.
 if(services.join('|')!==[...profile.servicosSolicitados].join('|')||profile.cidadeBase!==cidade||profile.ufBase!==uf){
  profile.servicosSolicitados=services;profile.servicosAprovados=[];profile.servicosAtivos=[];profile.status='em_analise';profile.online=false;
 }
 profile.cidadeBase=cidade;profile.ufBase=uf;
 await profile.save();await audit(req,'perfil.atualizado',profile._id);
 res.json({ok:true,perfil:publicProfile(profile)});
}
// Reabre a analise sempre que o motorista trocar a imagem de identificacao.
async function solicitarRevisaoFoto(req,res){
 const {profile}=await ownedProfile(req);assertIdle(profile);
 const usuario=await User.findById(own(req)).select('avatar').lean();
 if(!fotoValida(usuario?.avatar))error(409,'Envie uma foto valida antes de solicitar revisao');
 if(fotoAprovada(profile,usuario))return res.json({ok:true,status:profile.status,fotoAprovada:true});
 profile.online=false;profile.servicosAtivos=[];profile.servicosAprovados=[];
 profile.status='em_analise';profile.motivo='Nova foto de identificacao enviada: aguarda conferencia';
 await profile.save();await audit(req,'motorista.foto.revisao',profile._id);
 emit(req.app,profile.userId,'perfil:documentos',{status:profile.status,documento:'foto_motorista'});
 res.json({ok:true,status:profile.status,fotoAprovada:false});
}
async function setCNH(req,res){
 const {profile}=await ownedProfile(req,true);assertIdle(profile);
 const numero=String(req.body?.numero||'').replace(/\D/g,'');
 const categoria=upper(req.body?.categoria).replace(/[^A-Z]/g,'');
 const validade=validateDate(req.body?.validade);
 if(!/^\d{11}$/.test(numero))error(400,'Numero da CNH invalido');
 if(!['A','B','AB','C','AC','D','AD','E','AE'].includes(categoria))error(400,'Categoria da CNH invalida');
 if(validade<=new Date())error(400,'CNH ja vencida');
 if(typeof req.body.ear!=='boolean')error(400,'Informe se a CNH possui EAR');
 profile.cnh={numeroCriptografado:encrypt(numero),ultimos4:numero.slice(-4),categoria,validade,ear:req.body.ear,enviadoEm:new Date(),status:'pendente'};
 profile.status='em_analise';profile.online=false;profile.servicosAprovados=[];profile.servicosAtivos=[];
 await profile.save();await audit(req,'cnh.enviada',profile._id);
 res.json({ok:true,mensagem:'CNH registrada e aguardando verificacao manual',perfil:publicProfile(profile)});
}
function vehicleInput(body){
 const tipo=asText(body.tipo),placa=upper(body.placa).replace(/[^A-Z0-9]/g,''),marca=asText(body.marca,80),modelo=asText(body.modelo,80);
 const ano=Number(body.ano),capacidadeKg=Number(body.capacidadeKg||0),capacidadeM3=Number(body.capacidadeM3||0),lugares=Number(body.lugares||1);
 if(!VEHICLES.includes(tipo))error(400,'Tipo de veiculo invalido');
 if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa))error(400,'Placa invalida');
 if(!marca||!modelo)error(400,'Marca e modelo obrigatorios');
 if(!Number.isInteger(ano)||ano<1980||ano>new Date().getFullYear()+1)error(400,'Ano invalido');
 if(!Number.isFinite(capacidadeKg)||capacidadeKg<0||capacidadeKg>80000||!Number.isFinite(capacidadeM3)||capacidadeM3<0||capacidadeM3>150||!Number.isInteger(lugares)||lugares<1||lugares>60)error(400,'Capacidade invalida');
 const crlvValidade=body.crlvValidade?validateDate(body.crlvValidade):undefined;
 const rntrc=asText(body.rntrc,32);
 return {tipo,placa,marca,modelo,ano,cor:asText(body.cor,35),capacidadeKg,capacidadeM3,lugares,crlvValidade,rntrc};
}
async function listVehicles(req,res){await ownedProfile(req);res.json({ok:true,veiculos:await Vehicle.find({userId:own(req)}).sort({createdAt:-1}).lean()});}
async function createVehicle(req,res){
 const {profile,prof,owner}=await ownedProfile(req);assertIdle(profile);
 const v=await Vehicle.create({...vehicleInput(req.body),userId:owner,profissionalId:prof._id});
 profile.status='em_analise';profile.online=false;profile.servicosAtivos=[];await profile.save();
 await audit(req,'veiculo.cadastrado',v._id);
 res.status(201).json({ok:true,veiculo:v});
}
async function updateVehicle(req,res){
 const {profile}=await ownedProfile(req);assertIdle(profile);const v=await getVehicle(req);
 Object.assign(v,vehicleInput({...v.toObject(),...req.body}));v.dadosAtualizadosEm=new Date();v.status='pendente';v.motivo='Dados alterados: precisa de nova aprovacao';await v.save();
 if(String(profile.veiculoAtivoId||'')===String(v._id)) {profile.online=false;profile.servicosAtivos=[];}
 profile.status='em_analise';await profile.save();await audit(req,'veiculo.alterado',v._id);
 res.json({ok:true,veiculo:v});
}
async function selectVehicle(req,res){
 const {profile}=await ownedProfile(req);assertIdle(profile);const v=await getVehicle(req);
 if(v.status!=='aprovado' && !(profile.liberacaoManual === true && v.status==='pendente'))error(403,'Veículo ainda não aprovado');
 profile.veiculoAtivoId=v._id;profile.online=false;profile.servicosAtivos=[];await profile.save();
 res.json({ok:true,perfil:publicProfile(profile)});
}
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter:(_req,file,cb)=>{if(!['image/jpeg','image/png','application/pdf'].includes(file.mimetype))return cb(new Error('Apenas JPG, PNG ou PDF'));cb(null,true);}}).single('arquivo');
function validateFile(bytes,mime){if(!Buffer.isBuffer(bytes)||!bytes.length)error(400,'Arquivo vazio');if(mime==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))error(400,'JPG invalido');if(mime==='image/png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')error(400,'PNG invalido');if(mime==='application/pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')error(400,'PDF invalido');}
async function uploadDocument(req,res){
 const {profile}=await ownedProfile(req);assertIdle(profile);
 if(!req.file)error(400,'Envie arquivo no campo arquivo');
 const tipo=asText(req.body.tipo),allowed=['cnh_frente','cnh_verso','crlv','rntrc'];if(!allowed.includes(tipo))error(400,'Tipo documental invalido');
 const vehicleId=['crlv','rntrc'].includes(tipo)?id(req.body.veiculoId):null;
 if(vehicleId){const vehicle=await Vehicle.findOne({_id:vehicleId,userId:own(req)});if(!vehicle)error(404,'Veiculo nao encontrado');}
 validateFile(req.file.buffer,req.file.mimetype);
 if(!mongoose.connection.db)error(503,'MongoDB indisponivel');
 const bucket=new mongoose.mongo.GridFSBucket(mongoose.connection.db,{bucketName:'mobilidadeDocumentosPrivados'});
 const stream=bucket.openUploadStream(`doc-${Date.now()}`,{contentType:req.file.mimetype,metadata:{ownerId:String(req.userId),tipo}});
 await new Promise((resolve,reject)=>{const src=Readable.from(req.file.buffer);src.on('error',reject);stream.on('error',reject);stream.on('finish',resolve);src.pipe(stream);});
 let doc;
 try{doc=await Document.create({userId:own(req),tipo,veiculoId:vehicleId,arquivoId:stream.id,mime:req.file.mimetype,nome:asText(req.file.originalname,100),tamanho:req.file.size});}
 catch(e){await bucket.delete(stream.id).catch(()=>{});throw e;}
 if(tipo.startsWith('cnh')){profile.cnh.status='pendente';profile.status='em_analise';profile.online=false;profile.servicosAprovados=[];profile.servicosAtivos=[];await profile.save();}
 if(vehicleId){await Vehicle.updateOne({_id:vehicleId,userId:own(req)},{$set:{status:'pendente'}});profile.online=false;profile.servicosAtivos=[];await profile.save();}
 await audit(req,'documento.enviado',doc._id,tipo);
 res.status(201).json({ok:true,documento:{id:doc._id,tipo:doc.tipo,criadoEm:doc.createdAt}});
}
async function listDocuments(req,res){await ownedProfile(req);const docs=await Document.find({userId:own(req)}).select('-arquivoId').sort({createdAt:-1}).lean();res.json({ok:true,documentos:docs});}
async function getAvailability(req,res){const {profile}=await ownedProfile(req);res.json({ok:true,online:profile.online,servicosAtivos:profile.servicosAtivos,ultimaLocalizacaoEm:profile.ultimaLocalizacaoEm});}
async function setLocation(req,res){
 const p=calc.point({...req.body,endereco:'gps',cidade:'GPS',uf:'MS'});
 const {profile}=await ownedProfile(req);
 if(profile.status!=='aprovado' || (profile.liberacaoManual !== true && !calc.validCnh(profile)))error(403,'Perfil não aprovado ou CNH pendente de aprovação');
 const updated=await Profile.findOneAndUpdate({_id:profile._id},{$set:{localizacao:{type:'Point',coordinates:[p.lng,p.lat]},ultimaLocalizacaoEm:new Date()}},{new:true});
 res.json({ok:true,ultimaLocalizacaoEm:updated.ultimaLocalizacaoEm});
 if(profile.emViagemId){const job=await Job.findOne({_id:profile.emViagemId,motoristaId:own(req)}).lean();if(job&&['aceita','no_local','em_andamento'].includes(job.status))emit(req.app,job.clienteId,'viagem:localizacao',{id:String(job._id),latitude:p.lat,longitude:p.lng,atualizadoEm:updated.ultimaLocalizacaoEm});}
}
async function setAvailability(req,res){
 const {profile}=await ownedProfile(req);
 if(typeof req.body?.online!=='boolean')error(400,'online deve ser booleano');
 const enable=req.body.online;
 if(!enable){assertIdle(profile);profile.online=false;profile.servicosAtivos=[];await profile.save();return res.json({ok:true,online:false});}
 // Mesma elegibilidade e formas de recebimento dos profissionais tradicionais.
 const {prof}=await ownedProfile(req);
 if(!Pagamento.listarFormas(prof).length)error(409,'Ative Pix, Cartao ou Dinheiro em Formas de pagamento do perfil profissional');
 const usuario=await User.findById(own(req)).select('acessoExpiraEm subscriptionStatus status avatar').lean();
 if(profile.liberacaoManual !== true && !fotoAprovada(profile,usuario))error(403,'Foto do motorista ausente, alterada ou ainda não aprovada. Envie a foto e aguarde a análise no painel');
 if(!usuario||usuario.status==='blocked'||['overdue','blocked'].includes(usuario.subscriptionStatus)||!usuario.acessoExpiraEm||new Date(usuario.acessoExpiraEm)<=new Date())error(403,'Plano profissional inativo. Regularize o acesso como os demais prestadores');
 if(profile.status!=='aprovado' || (profile.liberacaoManual !== true && !calc.validCnh(profile)))error(403,'Perfil de mobilidade não aprovado ou CNH pendente');
 if(!profile.veiculoAtivoId)error(400,'Selecione um veiculo aprovado');
 const vehicle=await Vehicle.findOne({_id:profile.veiculoAtivoId,userId:own(req)}).lean();
 if(!vehicle || (profile.liberacaoManual === true ? !['aprovado','pendente'].includes(vehicle.status) : vehicle.status !== 'aprovado'))error(403,'Veículo não aprovado');
 if(!profile.ultimaLocalizacaoEm||new Date(profile.ultimaLocalizacaoEm).getTime()<Date.now()-120000)error(409,'Envie localizacao atual antes de ficar online');
 const services=arrayServices(req.body.servicosAtivos);
 for(const svc of services){
  if(!profile.servicosAprovados.includes(svc))error(403,`Modalidade nao aprovada: ${svc}`);
  if(!serviceVehicleCompatible(svc,vehicle.tipo) || (profile.liberacaoManual !== true && (!calc.cnhSupportsVehicle(profile.cnh?.categoria,vehicle.tipo)||!calc.validVehicle(vehicle,svc,1))) || (profile.liberacaoManual === true && svc.startsWith('corrida') && Number(vehicle.lugares || 0) < 2))error(403,`Veículo incompatível: ${svc}`);
 }
 // A elegibilidade geografica da moto e checada na origem de cada corrida,
 // nao na cidade de cadastro (o motorista pode atender varias cidades).
 profile.online=true;profile.servicosAtivos=services;await profile.save();
 res.json({ok:true,online:true,servicosAtivos:services,formasPagamento:Pagamento.listarFormas(prof)});
}
async function getDriverDashboard(req,res){
 const {profile}=await ownedProfile(req);
 const range=periodoFinanceiro(req.query?.periodo||'hoje');
 const filtroViagens={motoristaId:own(req),status:'concluida'};
 const filtroGastos={userId:own(req)};
 if(range.inicio){filtroViagens.conclusaoEm={$gte:range.inicio,$lte:range.fim};filtroGastos.data={$gte:range.inicio,$lte:range.fim};}
 const [completed,expenses,active,offers,confirmed,byService,usuario]=await Promise.all([
  Job.aggregate([{$match:filtroViagens},{$group:{_id:null,quantidade:{$sum:1},quilometros:{$sum:'$distanciaKm'},faturamentoCentavos:{$sum:'$valorCentavos'}}}]),
  Maintenance.aggregate([{$match:filtroGastos},{$group:{_id:null,totalCentavos:{$sum:'$valorCentavos'}}}]),
  Job.findOne({motoristaId:own(req),status:trust({$in:['aceita','no_local','em_andamento']})}).lean(),
  Job.find({ofertaMotoristaId:own(req),status:'ofertada',ofertaExpiraEm:trust({$gt:new Date()})}).select('-clienteId').limit(10).lean(),
  Job.aggregate([{$match:{...filtroViagens,'pagamento.status':'confirmado_cliente'}},{$group:{_id:null,totalCentavos:{$sum:'$valorCentavos'}}}]),
  Job.aggregate([{$match:filtroViagens},{$group:{_id:'$servico',quantidade:{$sum:1},valorCentavos:{$sum:'$valorCentavos'}}}]),
  User.findById(own(req)).select('planoAtivo acessoExpiraEm codigoIndicacao totalIndicacoes avatar').lean(),
 ]);
 const resumo={viagens:completed[0]?.quantidade||0,quilometros:completed[0]?.quilometros||0,faturamentoPrevistoCentavos:completed[0]?.faturamentoCentavos||0,recebimentosConfirmadosCentavos:confirmed[0]?.totalCentavos||0,despesasRegistradasCentavos:expenses[0]?.totalCentavos||0};
 res.json({ok:true,perfil:publicProfile(profile),fotoMotorista:usuario?.avatar||null,fotoAprovada:fotoAprovada(profile,usuario),periodo:range.periodo,timezone:range.timezone,
  resumo,hoje:range.periodo==='hoje'?resumo:undefined,
  porModalidade:byService.map(row=>({servico:row._id,quantidade:row.quantidade,valorCentavos:row.valorCentavos})),
  plano:{nome:usuario?.planoAtivo||null,acessoExpiraEm:usuario?.acessoExpiraEm||null},
  indicacao:{codigo:usuario?.codigoIndicacao||null,total:usuario?.totalIndicacoes||0},
  viagemAtiva:active,ofertas:offers,
  observacao:'Ganhos sao valores das viagens. Recebimento e declaratorio, sem conciliacao bancaria.'});
}
async function addMaintenance(req,res){
 await ownedProfile(req);const v=await getVehicle(req);
 const body=req.body||{},tipo=asText(body.tipo);if(!Maintenance.schema.path('tipo').enumValues.includes(tipo))error(400,'Tipo de gasto invalido');
 const value=Number(body.valorCentavos),km=body.quilometragem==null?undefined:Number(body.quilometragem),litros=body.litros==null?undefined:Number(body.litros);
 if(!Number.isSafeInteger(value)||value<0||value>100000000)error(400,'Valor em centavos invalido');
 if(km!==undefined&&(!Number.isFinite(km)||km<0||km>3000000))error(400,'Quilometragem invalida');
 if(litros!==undefined&&(!Number.isFinite(litros)||litros<0||litros>1000))error(400,'Litros invalidos');
 const registro=await Maintenance.create({userId:own(req),veiculoId:v._id,tipo,data:validateDate(body.data||new Date()),quilometragem:km,proximaTrocaKm:body.proximaTrocaKm,valorCentavos:value,litros,observacoes:asText(body.observacoes,500)});
 res.status(201).json({ok:true,registro});
}
async function getMaintenance(req,res){await ownedProfile(req);const v=await getVehicle(req);const rows=await Maintenance.find({userId:own(req),veiculoId:v._id}).sort({data:-1}).limit(100).lean();const sum=rows.reduce((a,x)=>a+x.valorCentavos,0);res.json({ok:true,registros:rows,totalDaPaginaCentavos:sum});}

function requestData(body){
 const origem=calc.point(body.origem),destino=calc.point(body.destino);
 const tipo=asText(body.tipo),tipoVeiculo=asText(body.veiculo);
 const servico=calc.serviceFor(tipo,tipoVeiculo,origem,destino);
 // A permissao geografica somente e conferida na cotacao depois da validacao
 // real do ponto de origem, para nao confiar em cidade digitada pelo cliente.
 const passageiros=body.passageiros==null?1:Number(body.passageiros);
 if(!Number.isInteger(passageiros)||passageiros<1||passageiros>6)error(400,'Quantidade de passageiros invalida');
 const carga=calc.validateCargo(body.carga,servico);
 if(tipo==='corrida'&&tipoVeiculo==='moto'&&passageiros!==1)error(400,'Moto permite um passageiro');
 if(tipo==='corrida'&&(carga.pesoKg||carga.volumeM3))error(400,'Corridas nao podem declarar transporte de carga');
 return {origem,destino,servico,tipoVeiculo,passageiros,carga};
}
async function quote(req,res){
 const params=requestData(req.body||{});
 params.categoriaCorrida=Comfort.categoriaCorrida(req.body?.categoriaCorrida,params.servico);
 await Promise.all([
  validarLocalidade(params.origem, req.body?.origem?.validacao),
  validarLocalidade(params.destino, req.body?.destino?.validacao),
 ]);
 if(params.servico==='corrida_moto'){const policy=await PoliticaMoto.consultar(params.origem);if(!policy.permitida)error(403,policy.mensagem);}
 if(params.categoriaCorrida==='comfort') {
  if(!Comfort.configurado()||!(await Comfort.disponivelNaOrigem(params.origem))) error(409,'Comfort indisponível nesta origem. Selecione Normal.');
 }
 const cliente=await User.findById(own(req)).select('genero preferenciaProfissional').lean();
 const preferencia=Preferencias.preferenciaParaCotacao(cliente,req.body?.preferenciaMotorista);
 const localidades=calc.tarifaLocalidades(params.origem,params.destino);
 const tariffs=await Tariff.find({servico:params.servico,ativo:true,$or:localidades}).lean();
 const tariff=localidades.map(loc=>tariffs.find(t=>t.uf===loc.uf&&t.cidade===loc.cidade)).find(Boolean);
 if(!tariff)error(409,'Tarifa indisponivel para esta modalidade e regiao; configure no painel administrativo');
 const route=await calc.route(params.origem,params.destino);
 if(route.km>4000)error(400,'Distancia muito grande');
 const valorBaseCentavos=calc.price(tariff,route.km,route.min,params.carga);
 const mercado=tariff.dinamicaAtiva!==true?{fator:1}:await Dinamica.multiplicadorNaOrigem(params.origem,params.servico);
 let value=Dinamica.precificar(valorBaseCentavos,mercado.fator);
 // Em condicoes equivalentes, moto nunca custa mais que 85% do carro.
 // A regra e aplicada quando a tarifa de carro do mesmo territorio esta disponivel.
 if(['corrida_moto','entrega_moto'].includes(params.servico)){
  const par=params.servico==='corrida_moto'?'corrida_carro':'entrega_carro';
  const pares=await Tariff.find({servico:par,ativo:true,$or:localidades}).lean();
  const comparavel=localidades.map(loc=>pares.find(t=>t.uf===loc.uf&&t.cidade===loc.cidade)).find(Boolean);
  if(comparavel){const precoCarro=calc.price(comparavel,route.km,route.min,params.carga);
   value=Math.min(value,Math.floor(precoCarro*0.85));
  }
 }
 const valorAntesComfort=value;
 const adicionalComfortCentavos=params.categoriaCorrida==='comfort'?Comfort.adicionalComfort(valorAntesComfort):0;
 value+=adicionalComfortCentavos;
 const multiplicadorDinamico=valorAntesComfort>valorBaseCentavos?Math.round(valorAntesComfort/valorBaseCentavos*100)/100:1;
 const adicionalDinamicoCentavos=Math.max(0,valorAntesComfort-valorBaseCentavos);
 const rec=await Quote.create({...params,...preferencia,clienteId:own(req),distanciaKm:route.km,duracaoMin:route.min,metodoRota:route.method,valorCentavos:value,valorBaseCentavos:Math.min(valorBaseCentavos,value),multiplicadorDinamico,adicionalDinamicoCentavos,adicionalComfortCentavos,tarifaId:tariff._id,expiraEm:new Date(Date.now()+5*60000)});
 res.status(201).json({ok:true,cotacao:{id:rec._id,servico:rec.servico,veiculo:rec.tipoVeiculo,distanciaKm:rec.distanciaKm,duracaoMin:rec.duracaoMin,metodoRota:rec.metodoRota,valorCentavos:rec.valorCentavos,valorBaseCentavos:rec.valorBaseCentavos,adicionalDinamicoCentavos:rec.adicionalDinamicoCentavos,adicionalComfortCentavos:rec.adicionalComfortCentavos,categoriaCorrida:rec.categoriaCorrida,multiplicadorDinamico:rec.multiplicadorDinamico,expiraEm:rec.expiraEm,preferenciaMotorista:rec.preferenciaMotorista},formasPagamento:Pagamento.FORMAS,recebimento:'diretamente_ao_prestador',aviso:route.method==='aproximacao'?'Estimativa tecnica, nao e rota rodoviaria real. Confira antes de cobrar.':undefined});
}
async function createRequest(req,res){
 const quoteId=id(req.body?.cotacaoId),client=own(req);
 const formaPagamento=Pagamento.validarForma(req.body?.metodoPagamento);
 const cotacao=await Quote.findOne({_id:quoteId,clienteId:client,expiraEm:trust({$gt:new Date()}),usadoEmSolicitacao:null}).lean();
 if(!cotacao)error(409,'Cotacao expirada, invalida ou ja utilizada');
 if(cotacao.servico==='corrida_moto'){const policy=await PoliticaMoto.consultar(cotacao.origem);if(!policy.permitida)error(403,policy.mensagem);}
 if(cotacao.metodoRota==='aproximacao'&&!require('../config/mobilidade').approximateEnabled())error(403,'Rota de aproximacao desabilitada');
 const jobId=new mongoose.Types.ObjectId();
 const claimed=await Quote.findOneAndUpdate({_id:cotacao._id,clienteId:client,usadoEmSolicitacao:null,expiraEm:trust({$gt:new Date()})},{$set:{usadoEmSolicitacao:jobId}},{new:true});
 if(!claimed)error(409,'Esta cotacao ja foi confirmada');
 let job;
 try{
  job=await Job.create({_id:jobId,cotacaoId:cotacao._id,clienteId:client,servico:cotacao.servico,tipoVeiculo:cotacao.tipoVeiculo,categoriaCorrida:cotacao.categoriaCorrida||'normal',adicionalComfortCentavos:cotacao.adicionalComfortCentavos||0,origem:cotacao.origem,destino:cotacao.destino,carga:cotacao.carga,passageiros:cotacao.passageiros,clienteGenero:cotacao.clienteGenero,preferenciaMotorista:cotacao.preferenciaMotorista,distanciaKm:cotacao.distanciaKm,duracaoMin:cotacao.duracaoMin,metodoRota:cotacao.metodoRota,valorCentavos:cotacao.valorCentavos,valorBaseCentavos:cotacao.valorBaseCentavos,multiplicadorDinamico:cotacao.multiplicadorDinamico,adicionalDinamicoCentavos:cotacao.adicionalDinamicoCentavos,pagamento:{metodo:formaPagamento,status:'pendente'}});
 }catch(e){await Quote.updateOne({_id:cotacao._id,usadoEmSolicitacao:jobId},{$set:{usadoEmSolicitacao:null}});throw e;}
 await audit(req,'solicitacao.criada',job._id,job.servico);
 try{await dispatchOne(req.app,job._id);}catch(e){console.error('[mobilidade] solicitacao registrada; tentativa de despacho sera repetida:',e.message);}
 const state=await Job.findById(job._id).select('status').lean();
 res.status(201).json({ok:true,solicitacao:{id:job._id,status:state?.status||job.status,valorCentavos:job.valorCentavos,metodoRota:job.metodoRota,pagamento:{metodo:formaPagamento,status:'pendente'}}});
}
async function listClientJobs(req,res){const jobs=await Job.find({clienteId:own(req)}).sort({createdAt:-1}).limit(60).lean();res.json({ok:true,solicitacoes:jobs});}
async function readJob(req,res){
 const job=await Job.findById(id(req.params.jobId)).lean();if(!job)error(404,'Solicitacao nao encontrada');
 const user=own(req),asClient=String(job.clienteId)===String(user),asDriver=String(job.motoristaId||'')===String(user),isAdmin=req.user?.role==='admin';
 if(!asClient&&!asDriver&&!isAdmin)error(403,'Sem acesso a esta solicitacao');
 const item={...job};delete item.codigoInicioCriptografado;delete item.codigoConclusaoCriptografado;

 if(!asClient&&!isAdmin){delete item.clienteId;delete item.clienteGenero;}
 res.json({ok:true,solicitacao:item});
}
async function clientDriverTracking(req,res){
 const job=await Job.findById(id(req.params.jobId)).lean();if(!job)error(404,'Solicitacao inexistente');
 if(String(job.clienteId)!==String(own(req))&&req.user?.role!=='admin')error(403,'Sem permissao para acompanhar este motorista');
 if(!job.motoristaId||!['aceita','no_local','em_andamento','concluida'].includes(job.status))return res.json({ok:true,motorista:null,localizacao:null});
 const User=require('../models/user');
 const [user,vehicle,profile]=await Promise.all([
  User.findById(job.motoristaId).select('name avatar').lean(),
  Vehicle.findOne({_id:job.veiculoId,userId:job.motoristaId}).select('tipo marca modelo placa cor').lean(),
  Profile.findOne({userId:job.motoristaId}).select('localizacao ultimaLocalizacaoEm profissionalId').lean()
 ]);
 const gpsFresh=['aceita','no_local','em_andamento'].includes(job.status)&&profile?.ultimaLocalizacaoEm&&new Date(profile.ultimaLocalizacaoEm).getTime()>Date.now()-120000;
 const pos=gpsFresh&&profile.localizacao?.coordinates?.length===2?{latitude:profile.localizacao.coordinates[1],longitude:profile.localizacao.coordinates[0],atualizadoEm:profile.ultimaLocalizacaoEm}:null;
 // Reputacao real: conta avaliacoes de corridas e do perfil profissional.
 let avaliacao={media:null,quantidade:0};
 try {
  avaliacao=await obterReputacaoMotorista({
   avaliacoes:Avaliacao,motoristaId:job.motoristaId,profissionalId:profile?.profissionalId
  });
 } catch (e) {
  // A avaliação não pode interromper o GPS nem o acompanhamento de uma corrida ativa.
  console.warn('[mobilidade] Falha ao consultar reputação do motorista:',e?.message||e);
 }
 res.set('Cache-Control','private, no-store');
 res.json({ok:true,motorista:{nome:user?.name||'Motorista aprovado',foto:user?.avatar||null,veiculo:vehicle,avaliacao},localizacao:pos,status:job.status});
}
async function getDemandAreas(req,res){
 const {profile}=await ownedProfile(req);
 if(profile.status!=='aprovado')error(403,'Motorista ainda nao aprovado');
 const servico=asText(req.query?.servico,40)||profile.servicosAtivos?.[0]||profile.servicosAprovados?.[0];
 if(!profile.servicosAprovados.includes(servico))error(403,'Modalidade nao autorizada');
 const xy=profile.localizacao?.coordinates;
 if(!Array.isArray(xy)||xy.length!==2||!profile.ultimaLocalizacaoEm||Date.now()-new Date(profile.ultimaLocalizacaoEm).getTime()>10*60_000)
  return res.json({ok:true,areas:[],aviso:'Ative o GPS para visualizar a demanda recente.'});
 const areas=await Dinamica.areasMotorista({lat:xy[1],lng:xy[0]},servico);
 res.set('Cache-Control','private, no-store');
 res.json({ok:true,areas,atualizadoEm:new Date().toISOString(),aviso:areas.length?'Areas estimadas por solicitacoes recentes. Nao garantem novas corridas.':'Sem solicitacoes suficientes para mostrar areas de demanda. Nenhuma area foi simulada.'});
}
async function getDriverOffers(req,res){
 const {profile}=await ownedProfile(req);
 if(profile.status!=='aprovado')error(403,'Motorista nao aprovado');
 const offers=await Job.find({status:'ofertada',ofertaMotoristaId:own(req),ofertaExpiraEm:trust({$gt:new Date()})}).select('-clienteId -clienteGenero').sort({createdAt:-1}).limit(10).lean();
 const xy=profile.localizacao?.coordinates;
 const enriched=offers.map(o=>({...o,distanciaAteColetaKm:Array.isArray(xy)&&xy.length===2?Math.round(calc.kilometers({lat:xy[1],lng:xy[0]},o.origem)*10)/10:null}));
 res.json({ok:true,ofertas:enriched});
}
// Mensagens específicas para ofertas que mudaram de situação enquanto o motorista as via.
async function motivoOfertaIndisponivel(jobId, motoristaId){
 const atual=await Job.findById(jobId).select('status motoristaId ofertaMotoristaId ofertaExpiraEm').lean();
 if(!atual) return 'A solicitação não existe mais.';
 if(atual.status==='cancelada')return 'O cliente cancelou a corrida.';
 if(atual.status==='sem_motorista')return 'A busca por motoristas foi encerrada.';
 if(['aceita','no_local','em_andamento','concluida'].includes(atual.status))
   return String(atual.motoristaId||'')===String(motoristaId)
     ? 'Esta corrida já está atribuída a você. Abra suas viagens.'
     : 'Esta corrida já foi aceita por outro motorista.';
 if(atual.status==='ofertada' && new Date(atual.ofertaExpiraEm||0)<=new Date())
   return 'O tempo para aceitar esta corrida terminou.';
 return 'Esta oferta deixou de estar disponível.';
}
async function acceptOffer(req,res){
 const {profile}=await ownedProfile(req),user=own(req),jobId=id(req.params.jobId);
 const job=await Job.findOne({_id:jobId,status:'ofertada',ofertaMotoristaId:user,ofertaExpiraEm:trust({$gt:new Date()})}).lean();
 if(!job)error(409,await motivoOfertaIndisponivel(jobId,user));
 const usuario=await User.findById(user).select('acessoExpiraEm subscriptionStatus status genero preferenciaAtendimento avatar').lean();
 if(!usuario||usuario.status==='blocked')error(403,'Conta bloqueada');
 if(!documentosAutorizados(profile,usuario))error(403,'O perfil ainda não está liberado no painel de mobilidade');
  if(['overdue','blocked'].includes(usuario.subscriptionStatus)||!usuario.acessoExpiraEm||new Date(usuario.acessoExpiraEm)<=new Date())error(403,'Plano profissional inativo');
 if(profile.status!=='aprovado')error(403,'Motorista não aprovado');
 if(!profile.online||profile.emViagemId)error(403,'Motorista indisponivel');
 if(!profile.servicosAtivos.includes(job.servico)||!profile.servicosAprovados.includes(job.servico))error(403,'Modalidade nao autorizada');
 if(job.servico==='corrida_moto'){const policy=await PoliticaMoto.consultar(job.origem);if(!policy.permitida)error(403,policy.mensagem);}
 if(!Preferencias.compativel(job,usuario))error(403,'Preferencia de atendimento incompativel');
 const prof=await Pagamento.buscarPreferencias(profile.profissionalId);if(!Pagamento.aceitaForma(prof,job.pagamento?.metodo))error(403,'Forma de pagamento nao aceita');
 const vehicle=await Vehicle.findOne({_id:profile.veiculoAtivoId,userId:user}).lean();
 if(!veiculoCompativel(profile,vehicle,job))error(403,'Veículo não compatível com esta viagem');
 const reserva={_id:profile._id,emViagemId:null,online:true,status:'aprovado'};
 const reserved=await Profile.findOneAndUpdate(reserva,{$set:{emViagemId:job._id}},{new:true});
 if(!reserved)error(409,'Voce ja possui viagem ativa ou nao esta disponivel');
 let accepted;
 try{accepted=await Job.findOneAndUpdate({_id:job._id,status:'ofertada',ofertaMotoristaId:user,ofertaExpiraEm:trust({$gt:new Date()})},{$set:{status:'aceita',motoristaId:user,veiculoId:vehicle._id,aceiteEm:new Date(),ofertaMotoristaId:null,ofertaVeiculoId:null,ofertaExpiraEm:null}},{new:true});}
 finally{if(!accepted)await Profile.updateOne({_id:profile._id,emViagemId:job._id},{$set:{emViagemId:null}});}
 if(!accepted)error(409,await motivoOfertaIndisponivel(job._id,user));
 emit(req.app,job.clienteId,'viagem:atualizada',{id:String(job._id),status:'aceita',motoristaId:String(user)});
 notificarClienteEtapa(job.clienteId,job._id,'aceita');
 res.json({ok:true,solicitacao:accepted});
}
async function rejectOffer(req,res){
 await ownedProfile(req);const job=await Job.findOneAndUpdate({_id:id(req.params.jobId),status:'ofertada',ofertaMotoristaId:own(req)},{$set:{status:'procurando',ofertaMotoristaId:null,ofertaVeiculoId:null,ofertaExpiraEm:null},$addToSet:{ignorados:own(req)}},{new:true});
 if(!job)error(409,'Oferta indisponivel');
 emit(req.app,job.clienteId,'solicitacao:status',{id:String(job._id),status:'procurando'});
 await dispatchOne(req.app,job._id);
 res.json({ok:true,status:'recusada'});
}
async function driverTrips(req,res){await ownedProfile(req);const jobs=await Job.find({motoristaId:own(req)}).sort({createdAt:-1}).limit(100).select('-clienteId -clienteGenero').lean();res.json({ok:true,viagens:jobs});}
async function assignedJob(req,expected){
 await ownedProfile(req);const job=await Job.findOne({_id:id(req.params.jobId),motoristaId:own(req)});
 if(!job)error(404,'Viagem nao encontrada para este motorista');
 if(expected&&!expected.includes(job.status))error(409,'Transicao de status nao permitida');return job;
}
async function driverArrive(req,res){const j=await assignedJob(req,['aceita']);const updated=await Job.findOneAndUpdate({_id:j._id,status:'aceita',motoristaId:own(req)},{$set:{status:'no_local',chegadaEm:new Date()}},{new:true});if(!updated)error(409,'Status ja mudou');emit(req.app,j.clienteId,'viagem:atualizada',{id:String(j._id),status:'no_local'});notificarClienteEtapa(j.clienteId,j._id,'no_local');res.json({ok:true,solicitacao:updated});}
// Transicoes sem PIN: somente o motorista designado pode iniciar e concluir,
// sempre na ordem aceita -> no_local -> em_andamento -> concluida.
async function tripTransition(req,res,phase){
 const current=phase==='iniciar'?'no_local':'em_andamento';
 const next=phase==='iniciar'?'em_andamento':'concluida';
 const job=await assignedJob(req,[current]);
 const fields={status:next};
 fields[phase==='iniciar'?'inicioEm':'conclusaoEm']=new Date();
 const updated=await Job.findOneAndUpdate(
  {_id:job._id,status:current,motoristaId:own(req)},
  {$set:fields},{new:true}
 );
 if(!updated)error(409,'A viagem ja mudou de etapa. Atualize a tela.');
 if(next==='concluida')await Profile.updateOne({userId:own(req),emViagemId:job._id},{$set:{emViagemId:null}});
 Promise.resolve().then(()=>audit(req,phase==='iniciar'?'viagem.iniciada':'viagem.concluida',job._id))
  .catch(e=>console.warn('[mobilidade] falha ao registrar auditoria de etapa:',e.message));
 emit(req.app,job.clienteId,'viagem:atualizada',{id:String(job._id),status:next});
 notificarClienteEtapa(job.clienteId,job._id,next);
 res.json({ok:true,solicitacao:updated});
}
const startTrip=(req,res)=>tripTransition(req,res,'iniciar');
const finishTrip=(req,res)=>tripTransition(req,res,'concluir');
async function clientCancel(req,res){
 const reason=asText(req.body?.motivo,400),j=await Job.findOneAndUpdate({_id:id(req.params.jobId),clienteId:own(req),status:trust({$in:['procurando','ofertada','aceita','no_local']})},{$set:{status:'cancelada',canceladoEm:new Date(),cancelamentoMotivo:reason,ofertaExpiraEm:null,'pagamento.status':'cancelado'}},{new:true});
 if(!j)error(409,'Nao e possivel cancelar esta solicitacao ou ela nao existe');
 if(j.motoristaId){
  await Profile.updateOne({userId:j.motoristaId,emViagemId:j._id},{$set:{emViagemId:null}});
  emit(req.app,j.motoristaId,'viagem:atualizada',{id:String(j._id),status:'cancelada',motivo:'cliente_cancelou'});
  await enviarPushParaUsuario(j.motoristaId,{
    title:'Corrida cancelada',body:'O cliente cancelou a corrida que você aceitou.',type:'MOBILIDADE_CANCELADA',
    data:{mobilidadeSolicitacaoId:String(j._id),motivo:'cliente_cancelou'}
  });
 }
 if(j.ofertaMotoristaId){
  emit(req.app,j.ofertaMotoristaId,'oferta:cancelada',{id:String(j._id),motivo:'cliente_cancelou'});
  await enviarPushParaUsuario(j.ofertaMotoristaId,{
    title:'Solicitação cancelada',body:'O cliente cancelou a solicitação antes da sua resposta.',type:'MOBILIDADE_CANCELADA',
    data:{mobilidadeSolicitacaoId:String(j._id),motivo:'cliente_cancelou'}
  });
 }
 res.json({ok:true,solicitacao:{id:j._id,status:'cancelada'}});
}
// Registro declaratorio, nao processa Pix nem cartao e nao substitui comprovante.
async function driverPaymentReceived(req,res){
 await ownedProfile(req);
 const job=await Job.findOneAndUpdate(
  {_id:id(req.params.jobId),motoristaId:own(req),status:'concluida','pagamento.status':'pendente'},
  {$set:{'pagamento.status':'informado_recebido','pagamento.informadoPeloMotoristaEm':new Date()}},
  {new:true}
 );
 if(!job)error(409,'Viagem nao concluida ou recebimento ja informado');
 await audit(req,'pagamento.motorista_informou',job._id,job.pagamento.metodo);
 emit(req.app,job.clienteId,'viagem:pagamento',{id:String(job._id),status:'informado_recebido',metodo:job.pagamento.metodo});
 res.json({ok:true,pagamento:job.pagamento,informacao:'Recebimento declarado pelo motorista; nao ha verificacao bancaria automatica'});
}
async function clientPaymentReview(req,res){
 const decisao=asText(req.body?.decisao,30),obs=asText(req.body?.observacao,400);
 if(!['confirmar','contestar'].includes(decisao))error(400,'Decisao invalida');
 if(decisao==='contestar'&&!obs)error(400,'Descreva o problema para contestar');
 const status=decisao==='confirmar'?'confirmado_cliente':'contestado';
 const job=await Job.findOneAndUpdate(
  {_id:id(req.params.jobId),clienteId:own(req),status:'concluida','pagamento.status':'informado_recebido'},
  {$set:{'pagamento.status':status,[decisao==='confirmar'?'pagamento.confirmadoPeloClienteEm':'pagamento.contestadoPeloClienteEm']:new Date(),'pagamento.observacao':decisao==='contestar'?obs:''}},
  {new:true}
 );
 if(!job)error(409,'O motorista ainda nao informou o recebimento, ou a decisao ja foi registrada');
 await audit(req,`pagamento.cliente_${decisao}`,job._id,decisao==='contestar'?'Contestacao registrada':'Pagamento confirmado');
 emit(req.app,job.motoristaId,'viagem:pagamento',{id:String(job._id),status,metodo:job.pagamento.metodo});
 res.json({ok:true,pagamento:job.pagamento,informacao:'Registro declaratorio, sem conciliacao automatica com bancos ou adquirentes'});
}
async function mensagensRapidas(req,res){
 const j=await Job.findById(id(req.params.jobId)).lean();if(!j)error(404,'Viagem nao encontrada');
 const user=own(req),cliente=String(j.clienteId)===String(user),motorista=String(j.motoristaId||'')===String(user);
 if(!cliente&&!motorista)error(403,'Sem acesso a esta viagem');
 res.json({ok:true,atalhos:ChatRapido.catalogo(cliente?'cliente':'motorista'),podeEnviar:ChatRapido.podeConversar(j.status,true)});
}
async function messages(req,res){
 const j=await Job.findById(id(req.params.jobId)).lean();if(!j)error(404,'Viagem nao encontrada');
 const user=own(req),cliente=String(j.clienteId)===String(user),motorista=String(j.motoristaId||'')===String(user);
 const participante=cliente||motorista;
 if(!participante&&req.user?.role!=='admin')error(403,'Nao participa da viagem');
 res.set('Cache-Control','private, no-store');
 if(req.method==='GET'){
  const msgs=await Message.find({solicitacaoId:j._id}).sort({createdAt:1}).limit(100).lean();
  return res.json({ok:true,mensagens:msgs,podeEnviar:ChatRapido.podeConversar(j.status,participante)});
 }
 if(!ChatRapido.podeConversar(j.status,participante))error(409,'O chat so funciona durante uma viagem aceita ou em andamento');
 const codigo=typeof req.body?.codigoRapido==='string'?req.body.codigoRapido.trim():null;
 const texto=codigo?ChatRapido.textoRapido(cliente?'cliente':'motorista',codigo):ChatRapido.limparTexto(req.body?.texto);
 if(!texto)error(400,codigo?'Mensagem rapida desconhecida':'Mensagem vazia');
 const limite=new Date(Date.now()-30_000);
 const recente=await Message.countDocuments({solicitacaoId:j._id,autorId:user,createdAt:trust({$gte:limite})});
 if(recente>=8)error(429,'Muitas mensagens em pouco tempo. Aguarde alguns segundos.');
 const row=await Message.create({solicitacaoId:j._id,autorId:user,texto,codigoRapido:codigo||null});
 const outro=cliente?j.motoristaId:j.clienteId;
 emit(req.app,outro,'viagem:mensagem',{viagemId:String(j._id),mensagem:{id:row._id,autorId:user,texto,createdAt:row.createdAt}});
 // A notificação aponta para a viagem e informa o papel do DESTINATARIO,
 // nao do remetente; isso permite abrir o chat correto dos dois lados.
 if(outro){
  const destinatarioTipo=cliente?'profissional':'cliente';
  Promise.resolve().then(()=>enviarPushParaUsuario(outro,{
    title:cliente?'Mensagem do passageiro':'Mensagem do motorista',
    body:'Toque para ler e responder no chat da corrida.',
    type:'MOBILIDADE_MENSAGEM',
    data:{mobilidadeSolicitacaoId:String(j._id),solicitacaoId:String(j._id),destinatarioTipo,abrirChat:'1'}
  })).catch(e=>console.warn('[mobilidade chat] Falha ao enviar push:',e?.message||e));
 }
 res.status(201).json({ok:true,mensagem:row});
}


async function reviewTrip(req,res){
 const cliente=own(req),jobId=id(req.params.jobId);
 const nota=Number(req.body?.nota),comentario=asText(req.body?.comentario,500);
 if(!Number.isInteger(nota)||nota<1||nota>5)error(400,'A nota deve ser um inteiro entre 1 e 5');
 const job=await Job.findOne({_id:jobId,clienteId:cliente,status:'concluida'}).lean();
 if(!job||!job.motoristaId)error(403,'Somente o cliente de uma viagem concluida pode avaliar');
 const profile=await Profile.findOne({userId:job.motoristaId}).select('profissionalId').lean();
 if(!profile)error(409,'Perfil de motorista nao encontrado');
 // A colecao especifica garante no maximo uma avaliacao por viagem.
 const novo=await AvaliacaoMobilidade.create({solicitacaoId:job._id,clienteId:cliente,motoristaId:job.motoristaId,profissionalId:profile.profissionalId,nota,comentario});
 let legado;
 try{
  legado=await Avaliacao.create({motorista:job.motoristaId,profissionalId:profile.profissionalId,
   profissionalUserId:job.motoristaId,clienteId:cliente,nota,comentario,origem:'motorista'});
  await AvaliacaoMobilidade.updateOne({_id:novo._id},{$set:{avaliacaoLegadaId:legado._id}});
 }catch(e){
  // A etapa de legado faz parte do contrato de reaproveitar reputacao do profissional.
  // Erro de persistencia nao produz avaliacao fantasma na colecao nova.
  if(!legado)await AvaliacaoMobilidade.deleteOne({_id:novo._id}).catch(()=>{});
  throw e;
 }
 try{
  const resumo=await Avaliacao.aggregate([
   {$match:{$or:[{profissionalId:profile.profissionalId},{profissionalUserId:job.motoristaId},{profissional:job.motoristaId}]}},
   {$group:{_id:null,quantidade:{$sum:1},media:{$avg:'$nota'}}}
  ]);
  if(resumo[0])await Profissional.updateOne({_id:profile.profissionalId},{$set:{totalAvaliacoes:resumo[0].quantidade,mediaAvaliacoes:Math.round(resumo[0].media*10)/10}});
 }catch(e){console.error('[mobilidade] falha ao atualizar nota resumida',e.message);}
 await audit(req,'viagem.avaliada',job._id,`nota ${nota}`);
 emit(req.app,job.motoristaId,'viagem:avaliacao',{id:String(job._id),nota});
 res.status(201).json({ok:true,avaliacao:{id:novo._id,solicitacaoId:jobId,nota,comentario}});
}
async function driverRatings(req,res){
 await ownedProfile(req);
 const avaliacoes=await AvaliacaoMobilidade.find({motoristaId:own(req)}).sort({createdAt:-1}).limit(80).select('nota comentario solicitacaoId createdAt').lean();
 res.json({ok:true,avaliacoes});
}

module.exports={reviewTrip,driverRatings,catalog,modalidadesOrigem,getProfile,setProfile,solicitarRevisaoFoto,setCNH,listVehicles,createVehicle,updateVehicle,selectVehicle,upload,uploadDocument,listDocuments,setLocation,getAvailability,setAvailability,getDriverDashboard,addMaintenance,getMaintenance,quote,createRequest,listClientJobs,readJob,clientDriverTracking,getDriverOffers,getDemandAreas,acceptOffer,rejectOffer,driverTrips,driverArrive,startTrip,finishTrip,clientCancel,driverPaymentReceived,clientPaymentReview,messages,mensagensRapidas,ownedProfile};
