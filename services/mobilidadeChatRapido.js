'use strict';
// Atalhos fixos: textos simples, sem links, coordenadas ou numeros de telefone.
const CATALOGO = Object.freeze({
  cliente:Object.freeze([
    {codigo:'estou_aqui',texto:'Estou no ponto combinado.'},
    {codigo:'onde_esta',texto:'Onde voce esta?'},
    {codigo:'ponto_referencia',texto:'Pode me informar um ponto de referencia?'},
    {codigo:'um_instante',texto:'Pode aguardar um instante, por favor?'},
    {codigo:'obrigado',texto:'Obrigado!'},
  ]),
  motorista:Object.freeze([
    {codigo:'a_caminho',texto:'Estou a caminho.'},
    {codigo:'cheguei',texto:'Cheguei ao ponto de embarque ou coleta.'},
    {codigo:'ponto_referencia',texto:'Pode me informar um ponto de referencia?'},
    {codigo:'transito',texto:'Estou no transito, mas ja estou indo.'},
    {codigo:'obrigado',texto:'Obrigado!'},
  ]),
});
const ATIVOS=new Set(['aceita','no_local','em_andamento']);
function catalogo(papel){return [...(CATALOGO[papel]||[])];}
function textoRapido(papel,codigo){return CATALOGO[papel]?.find(x=>x.codigo===codigo)?.texto||null;}
function limparTexto(x){return String(x||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,500);}
function podeConversar(status,autorizado){return autorizado===true && ATIVOS.has(status);}
module.exports={catalogo,textoRapido,limparTexto,podeConversar};
