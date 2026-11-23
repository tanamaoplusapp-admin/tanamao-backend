'use strict';
const mongoose=require('mongoose');
const S=mongoose.Schema;
const schema=new S({
 solicitacaoId:{type:S.Types.ObjectId,required:true,unique:true,ref:'MobilidadeSolicitacao'},
 clienteId:{type:S.Types.ObjectId,required:true,index:true,ref:'User'},
 motoristaId:{type:S.Types.ObjectId,required:true,index:true,ref:'User'},
 profissionalId:{type:S.Types.ObjectId,required:true,ref:'Profissional'},
 avaliacaoLegadaId:{type:S.Types.ObjectId,ref:'Avaliacao'},
 nota:{type:Number,required:true,min:1,max:5},
 comentario:{type:String,trim:true,maxlength:500,default:''},
},{timestamps:true});
schema.index({motoristaId:1,createdAt:-1});
module.exports=mongoose.models.MobilidadeAvaliacao||mongoose.model('MobilidadeAvaliacao',schema);
