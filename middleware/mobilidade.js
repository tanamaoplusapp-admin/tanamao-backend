'use strict';
const mongoose=require('mongoose');
const Profissional=require('../models/Profissional');
const {possuiProfissaoMotorista}=require('../services/mobilidadeProfissao');
const {enabled,betaAllowed}=require('../config/mobilidade');
const Audit=require('../models/MobilidadeAuditoria');
function asyncHandler(fn){return (req,res,next)=>Promise.resolve().then(()=>fn(req,res,next)).catch(next);}
function error(status,message){const e=new Error(message);e.status=status;throw e;}
function id(value){if(!mongoose.isValidObjectId(value))error(400,'Identificador invalido');return new mongoose.Types.ObjectId(value);}
function guardEnabled(req,res,next){if(!enabled())return res.status(503).json({ok:false,erro:'Mobilidade desativada no servidor (MOBILITY_MODULE_ENABLED=false)'});next();}
function betaGuard(req,res,next){if(!betaAllowed(req.userId,req.user?.role))return res.status(403).json({ok:false,erro:'Mobilidade em testes para contas autorizadas'});next();}
function admin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({ok:false,erro:'Somente administradores'});next();}
async function ownedProfessional(req){const user=id(req.userId||req.user?._id);const prof=await Profissional.findOne({$or:[{userId:user},{_id:user}]}).lean();if(!prof)error(403,'Ative seu perfil profissional antes de cadastrar mobilidade');if(!possuiProfissaoMotorista(prof))error(403,'Selecione a profissao Motorista no perfil profissional antes de usar mobilidade');return {prof,owner:user};}
function audit(req,action,target,detail=''){return Audit.create({autorId:req.userId,acao:action,alvoId:target||undefined,detalhe:detail});}
function privateError(err,req,res,next){if(res.headersSent)return next(err);const status=err.status||(err.name==='ValidationError'||err.name==='CastError'?400:err.code===11000?409:500);if(status>=500)console.error('[mobilidade]',err.name,err.message);return res.status(status).json({ok:false,erro:status>=500&&status!==503?'Erro interno de mobilidade':err.message});}
module.exports={asyncHandler,error,id,guardEnabled,betaGuard,admin,ownedProfessional,audit,privateError};
