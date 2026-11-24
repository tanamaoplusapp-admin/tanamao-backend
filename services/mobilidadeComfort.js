'use strict';
const trust=require('mongoose').trusted;
const Perfil=require('../models/MobilidadePerfil');
const Veiculo=require('../models/MobilidadeVeiculo');
const {kilometers}=require('./mobilidadeCalculo');

// Comfort é uma categoria de carro, NÃO uma autorização automática.
// Requer veículo explicitamente aprovado pelo administrador e taxa definida.
// Proposta inicial: 25% a mais que a categoria Normal.
// A variavel permite ajuste futuro sem alterar o codigo.
function taxaComfort(){
 const configurado=String(process.env.MOBILITY_COMFORT_MARKUP_PERCENT||'').trim();
 return configurado===''?25:Number(configurado);
}
function configurado(){
  const taxa=taxaComfort();
  return process.env.MOBILITY_COMFORT_ENABLED==='true' &&
    Number.isFinite(taxa)&&taxa>=5&&taxa<=75;
}
function categoriaCorrida(valor,servico){
  const cat=String(valor||'normal').toLowerCase().trim();
  if(!['normal','comfort'].includes(cat))throw Object.assign(new Error('Categoria de corrida inválida'),{status:400});
  if(cat==='comfort'&&servico!=='corrida_carro')throw Object.assign(new Error('Comfort disponível somente para corridas de carro'),{status:400});
  return cat;
}
function veiculoComfort(v){
  return Boolean(v&&v.tipo==='carro'&&v.status==='aprovado'&&v.confortoAprovado===true&&Number(v.lugares)>=5&&Number(v.ano)>=new Date().getFullYear()-8);
}
function adicionalComfort(valor){return Math.round(Number(valor||0)*taxaComfort()/100);}
async function disponivelNaOrigem(origem){
  if(!configurado()||!Number.isFinite(Number(origem?.lat))||!Number.isFinite(Number(origem?.lng)))return false;
  const online=await Perfil.find({status:'aprovado',online:true,servicosAtivos:'corrida_carro',emViagemId:null,
    ultimaLocalizacaoEm:trust({$gte:new Date(Date.now()-120000)})})
    .select('veiculoAtivoId localizacao').limit(300).lean();
  const veiculosProximos=online.filter(p=>{
    const xy=p.localizacao?.coordinates;
    return p.veiculoAtivoId&&Array.isArray(xy)&&xy.length===2&&
      kilometers({lat:xy[1],lng:xy[0]},origem)<=25;
  }).map(p=>p.veiculoAtivoId);
  if(!veiculosProximos.length)return false;
  const habilitados=await Veiculo.find({_id:trust({$in:veiculosProximos}),tipo:'carro',status:'aprovado',confortoAprovado:true,lugares:trust({$gte:5}),ano:trust({$gte:new Date().getFullYear()-8})}).limit(1).lean();
  return habilitados.some(veiculoComfort);
}
module.exports={configurado,taxaComfort,categoriaCorrida,adicionalComfort,veiculoComfort,disponivelNaOrigem};
