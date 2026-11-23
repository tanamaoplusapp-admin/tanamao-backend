'use strict';const mongoose=require('mongoose');const {SERVICES}=require('../config/mobilidade');const S=mongoose.Schema;
const schema=new S({
 servico:{type:String,enum:SERVICES,required:true},
 uf:{type:String,default:'*',uppercase:true,trim:true}, cidade:{type:String,default:'*',trim:true,lowercase:true},
 bandeiradaCentavos:{type:Number,required:true,min:0,max:10000000},
 porKmCentavos:{type:Number,required:true,min:0,max:10000000},
 porMinutoCentavos:{type:Number,default:0,min:0,max:1000000},
 porKgCentavos:{type:Number,default:0,min:0,max:1000000},
 porM3Centavos:{type:Number,default:0,min:0,max:1000000},
 minimoCentavos:{type:Number,required:true,min:0,max:10000000},
 ativo:{type:Boolean,default:false},
 alteradoPor:{type:S.Types.ObjectId,ref:'User'}
},{timestamps:true});
schema.index({servico:1,uf:1,cidade:1},{unique:true});
module.exports=mongoose.models.MobilidadeTarifa||mongoose.model('MobilidadeTarifa',schema);
