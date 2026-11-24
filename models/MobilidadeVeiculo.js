'use strict';
const mongoose = require('mongoose');
const {VEHICLES}=require('../config/mobilidade');
const S=mongoose.Schema;
const schema = new S({
  userId:{type:S.Types.ObjectId,required:true,ref:'User',index:true},
  profissionalId:{type:S.Types.ObjectId,required:true,ref:'Profissional',index:true},
  tipo:{type:String,enum:VEHICLES,required:true},
  placa:{type:String,required:true,uppercase:true,trim:true,unique:true},
  marca:{type:String,required:true,maxlength:80}, modelo:{type:String,required:true,maxlength:80},
  ano:{type:Number,min:1980,max:2100}, cor:{type:String,maxlength:35},
  proprietarioTerceiro:{type:Boolean,default:false}, // O CRLV pode estar em nome de terceiro.
  capacidadeKg:{type:Number,min:0,max:80000,default:0},
  capacidadeM3:{type:Number,min:0,max:150,default:0},
  lugares:{type:Number,min:1,max:60,default:1},
  confortoAprovado:{type:Boolean,default:false}, // Somente administrador pode marcar.
  crlvValidade:{type:Date}, dadosAtualizadosEm:{type:Date,default:Date.now}, rntrc:{type:String,maxlength:32},
  status:{type:String,enum:['pendente','aprovado','reprovado','suspenso'],default:'pendente',index:true},
  motivo:{type:String,maxlength:500}, avaliadoEm:Date, avaliadoPor:{type:S.Types.ObjectId,ref:'User'},
  placaConferidaEm:Date, placaConferidaPor:{type:S.Types.ObjectId,ref:'User'},
}, {timestamps:true});
module.exports=mongoose.models.MobilidadeVeiculo||mongoose.model('MobilidadeVeiculo',schema);
