'use strict';
// Executar no Shell do backend. Nao modifica documentos nem assinatura.
require('dotenv').config();
const mongoose=require('mongoose');
const User=require('../models/user');
const Profile=require('../models/MobilidadePerfil');
const Vehicle=require('../models/MobilidadeVeiculo');
const Profissional=require('../models/Profissional');
const {possuiProfissaoMotorista}=require('../services/mobilidadeProfissao');
(async()=>{
 const clienteEmail=String(process.argv[2]||'').trim().toLowerCase();
 const revogar=clienteEmail==='--revogar';
 if(!revogar && (!clienteEmail.includes('@')||clienteEmail==='teste@gmail.com'))throw Error('Informe o email de uma segunda conta de teste (cliente).');
 await mongoose.connect(process.env.MONGO_URI||process.env.MONGODB_URI,{dbName:process.env.MONGO_DB_NAME});
 const motorista=await User.findOne({email:'teste@gmail.com'}).select('_id status').lean();
 if(!motorista)throw Error('Conta motorista teste@gmail.com nao encontrada');
 const p=await Profile.findOne({userId:motorista._id});
 if(!p||p.emViagemId)throw Error('Perfil inexistente ou viagem ativa; finalize primeiro');
 if(revogar){p.online=false;p.servicosAtivos=[];if(p.liberacaoTeste?.clienteTesteId)p.liberacaoTeste.revogadaEm=new Date();await p.save();console.log('Teste revogado; perfil fora da busca comercial ate nova regularizacao administrativa.');return;}
 if(process.env.MOBILITY_TEST_MODE_ENABLED!=='true')throw Error('Ative MOBILITY_TEST_MODE_ENABLED=true no Render primeiro');
 const cliente=await User.findOne({email:clienteEmail}).select('_id status').lean();
 if(!cliente||String(cliente._id)===String(motorista._id)||['blocked','bloqueado','suspended','inactive'].includes(cliente.status)||['blocked','bloqueado','suspended','inactive'].includes(motorista.status))throw Error('Contas invalidas ou bloqueadas');
 if(p.status!=='aprovado'||!p.servicosAprovados.includes('corrida_carro'))throw Error('Aprove o cadastro e a modalidade carro no painel (sem aprovar documentos ficticios).');
 const prof=await Profissional.findById(p.profissionalId).lean();
 if(!possuiProfissaoMotorista(prof))throw Error('Selecione a profissao Motorista');
 if(!prof.aceitaDinheiro&&!prof.aceitaPix&&!prof.aceitaCartao)throw Error('Ative uma forma de pagamento no perfil profissional');
 const v=await Vehicle.findOne({userId:motorista._id,tipo:'carro',status:{$in:['aprovado','pendente']},lugares:{$gte:2}}).sort({createdAt:-1});
 if(!v)throw Error('Cadastre um carro com pelo menos dois lugares');
 p.veiculoAtivoId=v._id;p.online=false;p.servicosAtivos=[];
 p.liberacaoTeste={clienteTesteId:cliente._id,veiculoId:v._id,servicos:['corrida_carro'],expiraEm:new Date(Date.now()+86400000),revogadaEm:null};
 await p.save();console.log('Demonstracao autorizada por 24h. Motorista: teste@gmail.com. Cliente: '+clienteEmail+'. Expira: '+p.liberacaoTeste.expiraEm.toISOString());
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
