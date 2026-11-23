'use strict';const mongoose=require('mongoose');const S=mongoose.Schema;
const schema=new S({autorId:{type:S.Types.ObjectId,required:true},acao:{type:String,required:true,maxlength:80},alvoId:{type:S.Types.ObjectId},detalhe:{type:String,maxlength:300},em:{type:Date,default:Date.now}},{timestamps:false});
schema.index({alvoId:1,em:-1});
module.exports=mongoose.models.MobilidadeAuditoria||mongoose.model('MobilidadeAuditoria',schema);
