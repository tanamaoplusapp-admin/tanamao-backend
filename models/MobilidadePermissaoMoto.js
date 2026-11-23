'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  chave: {type:String,required:true,unique:true,immutable:true,maxlength:190},
  cidade: {type:String,required:true,maxlength:80},
  cidadeNormalizada: {type:String,required:true,maxlength:80},
  uf: {type:String,required:true,uppercase:true,minlength:2,maxlength:2},
  pais: {type:String,required:true,uppercase:true,minlength:2,maxlength:2},
  status: {type:String,enum:['pendente','autorizado','restrito'],default:'pendente',required:true},
  fundamento: {type:String,default:'',maxlength:1200},
  fonteOficial: {type:String,default:'',maxlength:800},
  analisadoEm: {type:Date,default:null},
  analisarNovamenteEm: {type:Date,default:null},
  analisadoPor: {type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  identificadaEm: {type:Date,default:Date.now},
  consultadaEm: {type:Date,default:Date.now},
  consultas: {type:Number,default:0,min:0},
  historico: [{
    statusAnterior: {type:String,default:''},
    statusNovo: {type:String,required:true},
    fundamento: {type:String,default:'',maxlength:1200},
    fonteOficial: {type:String,default:'',maxlength:800},
    em: {type:Date,default:Date.now},
    por: {type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  }],
}, {timestamps:true,versionKey:false});
schema.index({status:1,createdAt:-1});
schema.index({pais:1,uf:1,cidadeNormalizada:1});
module.exports=mongoose.models.MobilidadePermissaoMoto || mongoose.model('MobilidadePermissaoMoto',schema);
