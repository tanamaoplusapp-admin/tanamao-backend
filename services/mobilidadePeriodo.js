'use strict';
// Calendario por fuso sem depender de novas bibliotecas (Intl nativo do Node 20).
const VALIDOS=Object.freeze(['hoje','semana','mes','total']);
function partes(data, tz){
 const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 return Object.fromEntries(f.formatToParts(data).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
}
function meiaNoite(localDay,tz){
 const alvo=Date.UTC(localDay.y,localDay.m-1,localDay.d);
 let tentativa=alvo;
 for(let n=0;n<3;n++){
  const p=partes(new Date(tentativa),tz);
  const visto=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
  tentativa+=alvo-visto;
 }
 return new Date(tentativa);
}
function periodo(nome='hoje',at=new Date()){
 if(!VALIDOS.includes(nome)){const e=new Error('Periodo invalido: hoje, semana, mes ou total');e.status=400;throw e;}
 const zone=process.env.MOBILITY_TIMEZONE||'America/Campo_Grande';
 let p;
 try{p=partes(at,zone);}catch{const e=new Error('Timezone de mobilidade invalido');e.status=503;throw e;}
 if(nome==='total')return {periodo:nome,inicio:null,fim:at,timezone:zone};
 const base=new Date(Date.UTC(p.year,p.month-1,p.day));
 if(nome==='semana'){const delta=(base.getUTCDay()+6)%7;base.setUTCDate(base.getUTCDate()-delta);}
 if(nome==='mes')base.setUTCDate(1);
 const inicio=meiaNoite({y:base.getUTCFullYear(),m:base.getUTCMonth()+1,d:base.getUTCDate()},zone);
 return {periodo:nome,inicio,fim:at,timezone:zone};
}
module.exports={periodo,VALIDOS};
