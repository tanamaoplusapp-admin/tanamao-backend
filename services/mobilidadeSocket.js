'use strict';
const jwt=require('jsonwebtoken');
const mongoose=require('mongoose');
const User=require('../models/user');
const Profissional=require('../models/Profissional');
const {enabled,betaAllowed}=require('../config/mobilidade');
function setup(io){
 const ns=io.of('/mobilidade');
 ns.use(async(socket,next)=>{
  try{
   if(!enabled())throw new Error('modulo desligado');
   const token=socket.handshake.auth?.token;
   if(typeof token!=='string'||!token||!process.env.JWT_SECRET)throw new Error('sem autenticação');
   const decoded=jwt.verify(token,process.env.JWT_SECRET);
   const uid=decoded.sub||decoded.userId||decoded.id||decoded._id;
   if(!mongoose.isValidObjectId(uid))throw new Error('id invalido');
   const [user,prof]=await Promise.all([User.findById(uid).select('_id role').lean(),Profissional.findOne({$or:[{userId:uid},{_id:uid}]}).select('_id userId').lean()]);
   if(!user&&!prof)throw new Error('conta nao encontrada');
   socket.data.userId=String(prof?.userId||user?._id||uid);
   const conta=user||await User.findById(socket.data.userId).select('role').lean();
   if(!conta||!betaAllowed(socket.data.userId,conta.role))throw new Error('Beta restrito');
   next();
  }catch(e){next(new Error('Nao autorizado na mobilidade'));}
 });
 ns.on('connection',socket=>{
  socket.join(`mobilidade:usuario:${socket.data.userId}`);
  // Sem join arbitrario de salas. Cada socket entra apenas na sala do proprio token.
 });
 return ns;
}
function emit(app,userId,event,payload){if(!userId)return;const ns=app?.get?.('mobilityIo');if(ns)ns.to(`mobilidade:usuario:${String(userId)}`).emit(event,payload);}
module.exports={setup,emit};
