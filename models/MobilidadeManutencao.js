'use strict';const mongoose=require('mongoose');const S=mongoose.Schema;
const schema=new S({
 userId:{type:S.Types.ObjectId,required:true,index:true},veiculoId:{type:S.Types.ObjectId,required:true,index:true},
 tipo:{type:String,required:true,enum:['abastecimento','oleo','revisao','pneus','freios','seguro','imposto','outro']},
 data:{type:Date,required:true},quilometragem:{type:Number,min:0,max:3000000},proximaTrocaKm:{type:Number,min:0,max:3000000},
 valorCentavos:{type:Number,required:true,min:0,max:100000000},litros:{type:Number,min:0,max:1000},observacoes:{type:String,maxlength:500},
},{timestamps:true});
schema.index({veiculoId:1,data:-1});
module.exports=mongoose.models.MobilidadeManutencao||mongoose.model('MobilidadeManutencao',schema);
