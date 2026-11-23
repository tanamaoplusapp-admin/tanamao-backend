'use strict';const mongoose=require('mongoose');const S=mongoose.Schema;
const schema=new S({solicitacaoId:{type:S.Types.ObjectId,required:true,index:true},autorId:{type:S.Types.ObjectId,required:true},texto:{type:String,required:true,maxlength:1500}},{timestamps:true});
schema.index({solicitacaoId:1,createdAt:1});
module.exports=mongoose.models.MobilidadeMensagem||mongoose.model('MobilidadeMensagem',schema);
