'use strict';
// Regras puras, sem banco: a ordem das paradas e a tarifa da contratacao sao preservadas.
const MAX_PARADAS=3;
const erro=(status,message)=>{throw Object.assign(new Error(message),{status});};
const same=(a,b)=>!!a&&!!b&&Math.abs(a.lat-b.lat)<0.000001&&Math.abs(a.lng-b.lng)<0.000001;
function lista(raw,parse,servico){
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>MAX_PARADAS)erro(400,'Adicione até três paradas.');
 if(raw.length&&!['corrida_carro','corrida_moto'].includes(servico))erro(400,'Paradas disponíveis apenas em corridas de passageiros.');
 return raw.map(parse);
}
function validarSequencia(pontos,distancia){
 for(let i=1;i<pontos.length;i++)if(distancia(pontos[i-1],pontos[i])<0.015)erro(400,'Dois pontos consecutivos estão no mesmo local. Ajuste o trajeto.');
}
function tarifa(t){return Object.fromEntries(['bandeiradaCentavos','porKmCentavos','porMinutoCentavos','porKgCentavos','porM3Centavos','minimoCentavos'].map(k=>[k,Number(t[k]||0)]));}
function snapshot(t,fator,comfortPercent,comparavel,fatorCarro,motivo){return {tarifa:tarifa(t),fator,comfortPercent,comparavel:comparavel?tarifa(comparavel):null,fatorCarro:fatorCarro||1,motivo:motivo||null};}
function precificar(s,km,min,price,carga={}){
 if(!s?.tarifa||!Number.isFinite(km)||!Number.isFinite(min)||km<0||min<0||km>4000||!Number.isFinite(s.fator)||s.fator<1||s.fator>1.5)erro(409,'Não foi possível recalcular esta tarifa.');
 const base=price(s.tarifa,km,min,carga);
 let subtotal=Math.ceil(base*s.fator);
 if(s.comparavel)subtotal=Math.min(subtotal,Math.floor(Math.ceil(price(s.comparavel,km,min,carga)*s.fatorCarro)*0.85));
 const comfort=Math.round(subtotal*(s.comfortPercent||0)/100);
 const adicional=Math.max(0,subtotal-base);
 return {valorCentavos:subtotal+comfort,valorBaseCentavos:Math.min(base,subtotal+comfort),adicionalComfortCentavos:comfort,adicionalDinamicoCentavos:adicional,multiplicadorDinamico:adicional>0?Math.round(subtotal/base*100)/100:1,motivoDinamico:adicional?s.motivo:null};
}
function restante(job){return (job.paradas||[]).slice(job.paradasConcluidas||0);}
function alvo(job){return job.status==='em_andamento'?(restante(job)[0]||job.destino):job.origem;}
function somar(a,b){return {km:a.km+b.km,min:a.min+b.min,method:a.method==='aproximacao'||b.method==='aproximacao'?'aproximacao':'google_routes'};}
async function percurso(pontos,route,distancia,{permitirIguais=false}={}){
 if(!permitirIguais)validarSequencia(pontos,distancia);
 const trechos=await Promise.all(pontos.slice(1).map((p,i)=>distancia(pontos[i],p)<0.015?{km:0,min:0,method:'google_routes'}:route(pontos[i],p)));
 return trechos.reduce(somar,{km:0,min:0,method:'google_routes'});
}
module.exports={MAX_PARADAS,lista,validarSequencia,snapshot,precificar,restante,alvo,somar,percurso,same};
