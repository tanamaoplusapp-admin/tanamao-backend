'use strict';
const mongoose=require('mongoose');const S=mongoose.Schema;
const schema=new S({
 userId:{type:S.Types.ObjectId,required:true,index:true,ref:'User'},
 tipo:{type:String,required:true,enum:['cnh_frente','cnh_verso','crlv','rntrc','foto_frente_placa','foto_traseira_placa']},
 veiculoId:{type:S.Types.ObjectId,ref:'MobilidadeVeiculo',default:null},
 arquivoId:{type:S.Types.ObjectId,required:true},mime:{type:String,required:true},
 nome:{type:String,maxlength:100}, tamanho:{type:Number,max:5242880},
 criadoEm:{type:Date,default:Date.now}
}, {timestamps:true});
schema.index({userId:1,tipo:1,veiculoId:1,createdAt:-1});
module.exports=mongoose.models.MobilidadeDocumento||mongoose.model('MobilidadeDocumento',schema);
