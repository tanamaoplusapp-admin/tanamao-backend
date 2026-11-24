'use strict';
const {enviarPushParaUsuario}=require('./pushService');
const MSG={
  aceita:{title:'Motorista encontrado!',body:'Seu motorista aceitou a corrida e está indo até o embarque.'},
  no_local:{title:'Seu motorista chegou',body:'O veículo chegou ao embarque. Confira os dados do carro antes de entrar.'},
  em_andamento:{title:'Viagem iniciada',body:'Sua corrida começou. Acompanhe o percurso no Tanamão+.'},
  concluida:{title:'Viagem concluída',body:'A viagem terminou. Você pode avaliar o motorista no aplicativo.'},
};
function notificarClienteEtapa(clienteId,solicitacaoId,status){
  const info=MSG[status];if(!info||!clienteId||!solicitacaoId)return;
  // O status é persistido antes desta chamada. Falha do FCM não desfaz corrida.
  Promise.resolve().then(()=>enviarPushParaUsuario(clienteId,{
    title:info.title,body:info.body,type:'MOBILIDADE_CLIENTE_STATUS',
    data:{mobilidadeSolicitacaoId:String(solicitacaoId),status,destinatarioTipo:'cliente'},
  })).catch(e=>console.warn('[mobilidade/notificacao-cliente]',e?.message||'falha'));
}
module.exports={notificarClienteEtapa,MSG};
