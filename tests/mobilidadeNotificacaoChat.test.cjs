'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const controller=fs.readFileSync(path.join(__dirname,'../controllers/mobilidadeController.js'),'utf8');

test('push das mensagens inclui ID real da viagem e papel do destinatário',()=>{
  assert.match(controller,/type:'MOBILIDADE_MENSAGEM'/);
  assert.match(controller,/destinatarioTipo=cliente\?'profissional':'cliente'/);
  assert.match(controller,/mobilidadeSolicitacaoId:String\(j\._id\)/);
  assert.match(controller,/abrirChat:'1'/);
});
test('push vai para a outra parte, não para o remetente',()=>{
  assert.match(controller,/const outro=cliente\?j\.motoristaId:j\.clienteId/);
  assert.match(controller,/if\(outro\)\{/);
  assert.match(controller,/enviarPushParaUsuario\(outro,/);
});
