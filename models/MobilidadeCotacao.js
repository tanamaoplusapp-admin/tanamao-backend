'use strict';const mongoose=require('mongoose');const S=mongoose.Schema;
const local=new S({endereco:{type:String,required:true,maxlength:240},cidade:{type:String,required:true,maxlength:80},uf:{type:String,required:true,maxlength:2},pais:{type:String,maxlength:2,default:'BR'},estado:{type:String,maxlength:100},lat:{type:Number,required:true},lng:{type:Number,required:true}}, {_id:false});
const schema=new S({
 clienteId:{type:S.Types.ObjectId,required:true,index:true},testeOperacional:{type:Boolean,default:false},servico:{type:String,required:true},tipoVeiculo:{type:String,required:true},
 origem:{type:local,required:true},destino:{type:local,required:true},
 carga:{pesoKg:{type:Number,default:0},volumeM3:{type:Number,default:0},descricao:{type:String,maxlength:500}},
 passageiros:{type:Number,default:1},
 clienteGenero:{type:String,enum:['feminino','masculino','outro','nao_informado'],default:'nao_informado'},
 preferenciaMotorista:{type:String,enum:['todos','somente_mulheres','somente_homens'],default:'todos'},
 distanciaKm:{type:Number,required:true},duracaoMin:{type:Number,required:true},
 metodoRota:{type:String,enum:['google_routes','aproximacao'],required:true},
 valorCentavos:{type:Number,required:true},valorBaseCentavos:{type:Number},multiplicadorDinamico:{type:Number,default:1},adicionalDinamicoCentavos:{type:Number,default:0},tarifaId:{type:S.Types.ObjectId,required:true},
 expiraEm:{type:Date,required:true},usadoEmSolicitacao:{type:S.Types.ObjectId,default:null}
},{timestamps:true});
schema.index({expiraEm:1},{expireAfterSeconds:86400});
module.exports=mongoose.models.MobilidadeCotacao||mongoose.model('MobilidadeCotacao',schema);
module.exports.localSchema=local;
