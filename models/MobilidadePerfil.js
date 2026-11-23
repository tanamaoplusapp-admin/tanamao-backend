'use strict';
const mongoose = require('mongoose');
const { SERVICES } = require('../config/mobilidade');
const S = mongoose.Schema;
const localizacaoSchema = new S({type:{type:String,enum:['Point'],default:'Point'},coordinates:{type:[Number],required:true}},{_id:false});
const schema = new S({
  userId: { type: S.Types.ObjectId, required: true, unique: true, ref: 'User' },
  profissionalId: { type: S.Types.ObjectId, required: true, unique: true, ref: 'Profissional' },
  servicosSolicitados: [{ type: String, enum: SERVICES }],
  servicosAprovados: [{ type: String, enum: SERVICES }],
  servicosAtivos: [{ type: String, enum: SERVICES }],
  status: { type: String, enum: ['incompleto','em_analise','aprovado','reprovado','suspenso'], default:'incompleto', index:true },
  cnh: {
    numeroCriptografado: { type: String, select: false },
    ultimos4: String,
    categoria: { type: String, enum: ['A','B','AB','C','AC','D','AD','E','AE'] },
    validade: Date, ear: Boolean, enviadoEm:Date,
    status: { type:String, enum:['ausente','pendente','aprovado','reprovado'], default:'ausente' },
    motivo: {type:String, maxlength:500}, avaliadoEm: Date, avaliadoPor: {type:S.Types.ObjectId,ref:'User'}
  },
  veiculoAtivoId: { type:S.Types.ObjectId, ref:'MobilidadeVeiculo', default:null },
  online: { type:Boolean, default:false, index:true },
  emViagemId: {type:S.Types.ObjectId, ref:'MobilidadeSolicitacao', default:null },
  localizacao: {type:localizacaoSchema, default:undefined},
  ultimaLocalizacaoEm: {type:Date, default:null},
  cidadeBase: {type:String, maxlength:80}, ufBase: {type:String, uppercase:true, maxlength:2},
  motivo: {type:String, maxlength:500}, avaliadoEm:Date, avaliadoPor:{type:S.Types.ObjectId, ref:'User'},
  liberacaoTeste: {
    clienteTesteId: {type:S.Types.ObjectId,ref:'User',default:null},
    veiculoId: {type:S.Types.ObjectId,ref:'MobilidadeVeiculo',default:null},
    servicos: [{type:String,enum:['corrida_carro']}],
    concedidaEm: Date, expiraEm: Date, revogadaEm: Date,
    concedidaPor: {type:S.Types.ObjectId,ref:'User'},
    motivo: {type:String,maxlength:350},
  },
}, {timestamps:true, minimize:false});
schema.index({localizacao:'2dsphere'}, {sparse:true});
schema.index({online:1,status:1,ultimaLocalizacaoEm:-1});
module.exports = mongoose.models.MobilidadePerfil || mongoose.model('MobilidadePerfil',schema);
