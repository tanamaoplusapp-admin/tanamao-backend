'use strict';
/**
 * Preco dinamico Tanamao+: agrega apenas solicitacoes reais e motoristas online.
 * Nao copia tarifas de terceiros. Nunca revela enderecos ou viagens individuais.
 */
const mongoose = require('mongoose');
const Job = require('../models/MobilidadeSolicitacao');
const Profile = require('../models/MobilidadePerfil');
const { kilometers } = require('./mobilidadeCalculo');
const STATUS_DEMANDA = new Set(['procurando', 'ofertada']);
const STATUS_MAPA = new Set(['procurando','ofertada','aceita','no_local','em_andamento','concluida']);
const JANELA_MIN = 15;
const RAIO_KM = 3;
const MAX_FATOR = 1.5;

function coordenadasValidas(p) {
  return !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) &&
    Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;
}
function posicaoPerfil(p) {
  const xy = p?.localizacao?.coordinates;
  return Array.isArray(xy) && xy.length === 2 && Number.isFinite(Number(xy[0])) && Number.isFinite(Number(xy[1]))
    ? {lat: Number(xy[1]), lng: Number(xy[0])} : null;
}
function proximos(ponto, items, pegarPonto, raio=RAIO_KM) {
  return (items || []).filter(item => {
    const p=pegarPonto(item);
    return coordenadasValidas(p) && kilometers(ponto,p) <= raio;
  });
}
function fatorDinamico(demanda,oferta,ativo=true) {
  const d=Math.max(0,Math.floor(Number(demanda)||0));
  const o=Math.max(0,Math.floor(Number(oferta)||0));
  // Amostras pequenas nao justificam acrescimo; evita precos arbitrarios.
  if(!ativo || d<3 || d <= o) return 1;
  const proporcao=d/Math.max(1,o);
  if(proporcao<1.5) return 1;
  const extra=0.10 + (proporcao-1.5)*0.16;
  return Math.round(Math.min(MAX_FATOR,1+Math.max(0,extra))*100)/100;
}
function precificar(baseCentavos,fator) {
  if(!Number.isSafeInteger(baseCentavos)||baseCentavos<0)throw new Error('Preco base invalido');
  if(!Number.isFinite(fator)||fator<1||fator>MAX_FATOR)throw new Error('Fator fora do intervalo permitido');
  return Math.ceil(baseCentavos*fator);
}
async function amostra(servico,janelaMin=JANELA_MIN,paraMapa=false){
  const limite=new Date(Date.now()-janelaMin*60_000);
  const onlineMin=new Date(Date.now()-120_000);
  const [jobs,profiles]=await Promise.all([
    Job.find({servico,testeOperacional:mongoose.trusted({$ne:true}),status:mongoose.trusted({$in:paraMapa?[...STATUS_MAPA]:[...STATUS_DEMANDA]}),createdAt:mongoose.trusted({$gte:limite})})
      .select('origem status createdAt').sort({createdAt:-1}).limit(500).lean(),
    Profile.find({status:'aprovado',online:true,servicosAtivos:servico,ultimaLocalizacaoEm:mongoose.trusted({$gte:onlineMin})})
      .select('localizacao ultimaLocalizacaoEm').limit(400).lean(),
  ]);
  return {jobs,profiles};
}
async function multiplicadorNaOrigem(origem,servico){
  if(process.env.MOBILITY_DYNAMIC_PRICING==='false' || !/^(corrida|entrega)_/.test(servico))
    return {fator:1,demanda:0,motoristasProximos:0};
  if(!coordenadasValidas(origem))return {fator:1,demanda:0,motoristasProximos:0};
  const {jobs,profiles}=await amostra(servico);
  const demanda=proximos(origem,jobs,x=>x.origem).filter(x=>STATUS_DEMANDA.has(x.status)).length;
  const motoristasProximos=proximos(origem,profiles,posicaoPerfil).length;
  return {fator:fatorDinamico(demanda,motoristasProximos,true),demanda,motoristasProximos};
}
function centroGrade(p,passo=0.02){
  return {lat:Math.round(Number(p.lat)/passo)*passo,lng:Math.round(Number(p.lng)/passo)*passo};
}
function mapaDemanda(jobs,profiles,centro,servico){
  if(!coordenadasValidas(centro))return [];
  const grupos=new Map();
  const idadeMax=Date.now()-30*60_000;
  for(const item of jobs||[]){
    if(item.testeOperacional===true)continue;
    if(item.servico && item.servico!==servico)continue;
    if(!STATUS_MAPA.has(item.status))continue;
    if(item.createdAt && new Date(item.createdAt).getTime()<idadeMax)continue;
    if(!coordenadasValidas(item.origem) || kilometers(centro,item.origem)>15)continue;
    const celula=centroGrade(item.origem);const chave=`${celula.lat.toFixed(3)}|${celula.lng.toFixed(3)}`;
    const atual=grupos.get(chave)||{celula,demanda:0};atual.demanda++;grupos.set(chave,atual);
  }
  return [...grupos.values()].filter(g=>g.demanda>=3).map(g=>{
    const oferta=proximos(g.celula,profiles,posicaoPerfil,1.5).length;
    const fator=fatorDinamico(g.demanda,oferta,process.env.MOBILITY_DYNAMIC_PRICING!=='false');
    return {latitude:Number(g.celula.lat.toFixed(4)),longitude:Number(g.celula.lng.toFixed(4)),raioMetros:1100,
      nivel:g.demanda>=8?'alta':g.demanda>=5?'media':'moderada',solicitacoes:g.demanda,
      multiplicador:fator};
  }).sort((a,b)=>b.solicitacoes-a.solicitacoes).slice(0,12);
}
async function areasMotorista(centro,servico){
  const {jobs,profiles}=await amostra(servico,30,true);
  return mapaDemanda(jobs,profiles,centro,servico);
}
module.exports={fatorDinamico,precificar,coordenadasValidas,posicaoPerfil,proximos,centroGrade,mapaDemanda,multiplicadorNaOrigem,areasMotorista};
