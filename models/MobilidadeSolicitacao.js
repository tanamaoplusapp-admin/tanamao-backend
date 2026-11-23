'use strict';const mongoose=require('mongoose');const S=mongoose.Schema;
const schema=new S({
 clienteId:{type:S.Types.ObjectId,required:true,index:true},
 cotacaoId:{type:S.Types.ObjectId,required:true,unique:true},
 servico:{type:String,required:true,index:true},tipoVeiculo:{type:String,required:true},
 origem:{type:Object,required:true},destino:{type:Object,required:true},
 carga:{type:Object},passageiros:{type:Number,default:1},
 clienteGenero:{type:String,enum:['feminino','masculino','outro','nao_informado'],default:'nao_informado'},
 preferenciaMotorista:{type:String,enum:['todos','somente_mulheres','somente_homens'],default:'todos'},
 distanciaKm:{type:Number,required:true},duracaoMin:{type:Number,required:true},metodoRota:{type:String},valorCentavos:{type:Number,required:true},
 valorBaseCentavos:{type:Number},multiplicadorDinamico:{type:Number,default:1},adicionalDinamicoCentavos:{type:Number,default:0},
 status:{type:String,enum:['procurando','ofertada','aceita','no_local','em_andamento','concluida','cancelada','sem_motorista'],default:'procurando',index:true},
 motoristaId:{type:S.Types.ObjectId,default:null,index:true},
 veiculoId:{type:S.Types.ObjectId,default:null},
 ofertaMotoristaId:{type:S.Types.ObjectId,default:null},
 ofertaVeiculoId:{type:S.Types.ObjectId,default:null},ofertaExpiraEm:Date,
 ignorados:[{type:S.Types.ObjectId}],tentativas:{type:Number,default:0},
 codigoInicioCriptografado:{type:String,select:false},codigoConclusaoCriptografado:{type:String,select:false},
 codigoErradoTentativas:{type:Number,default:0},
 aceiteEm:Date,chegadaEm:Date,inicioEm:Date,conclusaoEm:Date,canceladoEm:Date,
 cancelamentoMotivo:{type:String,maxlength:400},
 // Mesmos meios aceitos por qualquer prestador (recebimento fora do app).
 pagamento:{
  metodo:{type:String,required:true,enum:['pix','cartao','dinheiro']},
  status:{type:String,enum:['pendente','informado_recebido','confirmado_cliente','contestado','cancelado'],default:'pendente'},
  informadoPeloMotoristaEm:Date,confirmadoPeloClienteEm:Date,contestadoPeloClienteEm:Date,
  observacao:{type:String,maxlength:400}
 },
 },{timestamps:true});
schema.index({status:1,createdAt:1});schema.index({motoristaId:1,updatedAt:-1});
// Evita mais de uma viagem ativa por cliente nesta primeira versao.
schema.index({clienteId:1},{unique:true,partialFilterExpression:{status:{$in:['procurando','ofertada','aceita','no_local','em_andamento']}}});
module.exports=mongoose.models.MobilidadeSolicitacao||mongoose.model('MobilidadeSolicitacao',schema);
