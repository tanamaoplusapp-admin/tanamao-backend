'use strict';
// Runs without a database connection, using the Mongoose already installed by the backend.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);
const Pedido = require('../models/PedidoAberto');
const Profissao = require('../models/Profissao');
const Profissional = require('../models/Profissional');
const User = require('../models/user');
const Chat = require('../models/Chat');
const T = obj => mongoose.trusted(obj);
const id = () => new mongoose.Types.ObjectId();
const a = id(), b = id(), now = new Date();
function cast(query) {
  query._castConditions();
  if (query.error()) throw query.error();
  return query.getFilter();
}
test('catalogo: $in preservado com protecao global', () => {
  const f = cast(Profissao.find({ativa:true,categoriaId:T({$in:[a]})}));
  assert.equal(String(f.categoriaId.$in[0]), String(a));
});
test('oportunidades: filtros de data, cidade, especialidade e outro cliente', () => {
  const f = cast(Pedido.find({$or:[{status:'aberto',expiraEm:T({$gt:now}),profissaoId:T({$in:[a]}),cidadeSlug:'ponta-pora',uf:'MS'},{'propostas.prestador':b}],cliente:T({$ne:a})}));
  assert.equal(String(f.cliente.$ne),String(a));
  assert.equal(f.$or[0].expiraEm.$gt.getTime(),now.getTime());
  assert.equal(String(f.$or[0].profissaoId.$in[0]),String(a));
  assert.equal(f.$or[0].cidadeSlug,'ponta-pora');
});
test('contagem e expiracao: datas e operadores de existencia', () => {
  assert.equal(cast(Pedido.countDocuments({cliente:a,status:'aberto',expiraEm:T({$gt:now}),'propostas.0':T({$exists:false})})).expiraEm.$gt.getTime(),now.getTime());
  assert.equal(cast(Pedido.updateMany({status:'aberto',expiraEm:T({$lte:now})},{$set:{status:'expirado'}})).expiraEm.$lte.getTime(),now.getTime());
  assert.equal(cast(Pedido.countDocuments({cliente:a,createdAt:T({$gte:now})})).createdAt.$gte.getTime(),now.getTime());
});
test('worker: selecao de eventos e bloqueio temporario', () => {
  const f=cast(Pedido.findOneAndUpdate({$and:[{$or:[{processandoAte:null},{processandoAte:T({$lte:now})}]},{$or:[{status:'aberto',expiraEm:T({$gt:now}),proximaBusca:T({$lte:now})},{eventos:T({$elemMatch:{done:false}})}]}]},{$set:{processandoAte:now}}));
  assert.equal(f.$and[0].$or[1].processandoAte.$lte.getTime(),now.getTime());
  assert.equal(f.$and[1].$or[1].eventos.$elemMatch.done,false);
});
test('worker: prestadores e contas compatíveis',()=>{
  const f=cast(Profissional.find({userId:T({$exists:true,$ne:null}),$or:[{profissaoId:a},{'profissoesDetalhadas.profissaoId':a}]}));
  assert.equal(f.userId.$exists,true);
  assert.equal(f.userId.$ne,null);
  assert.equal(String(cast(User.find({_id:T({$in:[a,b]})}))._id.$in[1]),String(b));
});
test('proposta: limite e unicidade por prestador',()=>{
  const f=cast(Pedido.updateOne({_id:a,status:'aberto',expiraEm:T({$gt:now}),'propostas.prestador':T({$ne:b}),'propostas.49':T({$exists:false})},{$set:{status:'aberto'}}));
  assert.equal(String(f['propostas.prestador'].$ne),String(b));
  assert.equal(f['propostas.49'].$exists,false);
});
test('aceite: somente a proposta da versao conferida',()=>{
  const f=cast(Pedido.findOneAndUpdate({_id:a,status:'aberto',expiraEm:T({$gt:now}),propostas:T({$elemMatch:{_id:b,criadaEm:now}})},{$set:{status:'aceito'}}));
  assert.equal(String(f.propostas.$elemMatch._id),String(b));
  assert.equal(f.propostas.$elemMatch.criadaEm.getTime(),now.getTime());
});
test('chat: conversa entre os dois participantes',()=>{
  const f=cast(Chat.findOne({participantes:T({$all:[a,b],$size:2}),serviceId:null}));
  assert.equal(f.participantes.$size,2);
  assert.equal(String(f.participantes.$all[0]),String(a));
});
test('objeto de operador sem trusted continua bloqueado',()=>{
  assert.throws(()=>cast(Pedido.find({cliente:{$ne:a}})),/Cast to ObjectId/i);
  assert.equal(mongoose.get('sanitizeFilter'),true);
});
