'use strict';
const axios=require('axios');
const {SERVICES,VEHICLES,serviceVehicleCompatible,approximateEnabled}=require('../config/mobilidade');
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
const norm=(value)=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function point(raw){
 if(!raw||typeof raw!=='object')fail(400,'Origem e destino sao obrigatorios');
 const lat=Number(raw.lat??raw.latitude),lng=Number(raw.lng??raw.longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)fail(400,'Coordenadas invalidas');
 const endereco=String(raw.endereco||'').trim().slice(0,240);
 const cidade=String(raw.cidade||'').trim().slice(0,80);
 const pais=String(raw.pais || (String(raw.uf||'').toUpperCase()==='PY'?'PY':'BR')).trim().toUpperCase();
 const uf=String(raw.uf || (pais!=='BR'?pais:'')).trim().toUpperCase();
 const estado=String(raw.estado||'').trim().slice(0,100);
 if(!endereco||!cidade||!/^[A-Z]{2}$/.test(uf)||!/^[A-Z]{2}$/.test(pais))fail(400,'Endereco, cidade, UF/regiao e pais obrigatorios');
 if(pais!=='BR'&&uf!==pais)fail(400,'Codigo de pais e regiao incompativeis');
 return {lat,lng,endereco,cidade,uf,pais,estado};
}
// Na fronteira seca, Ponta Pora e Pedro Juan Caballero compartilham a zona
// comercial local. Preservamos pais, cidade e coordenadas originais para
// fiscalizacao, pagamentos e regras aplicaveis em cada jurisdicao.
function fronteiraIntegrada(a,b){
 const br=p=>(p.pais||'BR')==='BR'&&p.uf==='MS'&&norm(p.cidade)==='ponta pora';
 const py=p=>p.pais==='PY'&&norm(p.cidade)==='pedro juan caballero';
 return (br(a)&&py(b))||(py(a)&&br(b));
}
function scope(origem,destino){
 const paisA=origem.pais||'BR',paisB=destino.pais||'BR';
 if(fronteiraIntegrada(origem,destino))return 'frete_local';
 if(paisA!==paisB)return 'frete_internacional';
 if(paisA==='BR'&&origem.uf!==destino.uf)return 'frete_interestadual';
 if(norm(origem.cidade)!==norm(destino.cidade))return 'frete_intermunicipal';
 return 'frete_local';
}
function tarifaLocalidades(origem,destino){
 const locais=[{uf:origem.uf,cidade:norm(origem.cidade)},{uf:origem.uf,cidade:'*'}];
 // No trajeto PJC -> Ponta Pora, admite a tarifa da regiao integrada
 // somente se nao houver tarifa mais especifica para a origem PY.
 if(fronteiraIntegrada(origem,destino)&&origem.pais==='PY'){
  locais.push({uf:'MS',cidade:'ponta pora'},{uf:'MS',cidade:'*'});
 }
 locais.push({uf:'*',cidade:'*'});
 return locais;
}
function serviceFor(tipo,veiculo,origem,destino){if(!VEHICLES.includes(veiculo))fail(400,'Veiculo desconhecido');if(tipo==='corrida'){if(!['moto','carro'].includes(veiculo))fail(400,'Corridas exigem moto ou carro');return `corrida_${veiculo}`;}if(tipo==='entrega'){if(veiculo==='caminhao')fail(400,'Para caminhao selecione frete');return veiculo==='moto'?'entrega_moto':'entrega_carro';}if(tipo==='frete'){if(veiculo==='moto')fail(400,'Frete de carga nao aceita moto');return scope(origem,destino);}fail(400,'Tipo invalido');}
function kilometers(a,b){const R=6371,toRad=x=>x*Math.PI/180;const dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng);const aa=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa));}
async function route(a,b){
 const googleKey=process.env.MOBILITY_GOOGLE_ROUTES_API_KEY;
 if(googleKey){
  try{
   const {data}=await axios.post('https://routes.googleapis.com/directions/v2:computeRoutes',{
    origin:{location:{latLng:{latitude:a.lat,longitude:a.lng}}},destination:{location:{latLng:{latitude:b.lat,longitude:b.lng}}},travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',languageCode:'pt-BR'
   },{timeout:7000,headers:{'X-Goog-Api-Key':googleKey,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration'}});
   const first=data.routes?.[0];if(first?.distanceMeters){return {km:first.distanceMeters/1000,min:Math.max(1,Math.ceil((parseFloat(first.duration)||0)/60)),method:'google_routes'};}
  }catch(e){if(!approximateEnabled())fail(503,'Servico de rotas indisponivel');}
 }
 if(!approximateEnabled())fail(503,'Configure MOBILITY_GOOGLE_ROUTES_API_KEY ou habilite estimativas apenas para testes');
 const km=Math.max(0.8,Math.round(kilometers(a,b)*1.3*100)/100);const velocidade=km>70?65:28;
 return {km,min:Math.max(3,Math.ceil(km/velocidade*60)),method:'aproximacao'};
}
function price(tariff,km,min,carga={}){const x=tariff.bandeiradaCentavos+Math.ceil(km*tariff.porKmCentavos)+Math.ceil(min*tariff.porMinutoCentavos)+Math.ceil((carga.pesoKg||0)*(tariff.porKgCentavos||0))+Math.ceil((carga.volumeM3||0)*(tariff.porM3Centavos||0));if(!Number.isSafeInteger(x)||x<0||x>100000000)fail(409,'Valor de frete fora do limite; revise a tarifa');return Math.max(tariff.minimoCentavos,x);}
function validateCargo(raw,service){const data=raw&&typeof raw==='object'?raw:{};const pesoKg=Number(data.pesoKg||0),volumeM3=Number(data.volumeM3||0);if(!Number.isFinite(pesoKg)||pesoKg<0||pesoKg>80000||!Number.isFinite(volumeM3)||volumeM3<0||volumeM3>150)fail(400,'Dimensoes de carga invalidas');if((service.startsWith('entrega')||service.startsWith('frete'))&&(!pesoKg||!String(data.descricao||'').trim()))fail(400,'Carga requer descricao e peso');return {pesoKg,volumeM3,descricao:String(data.descricao||'').trim().slice(0,500)};}
function validCnh(profile,now=new Date()){return profile?.cnh?.status==='aprovado'&&profile?.cnh?.validade&&new Date(profile.cnh.validade)>now;}
function cnhSupportsVehicle(category,type){const cat=String(category||'');if(type==='moto')return cat.includes('A');if(type==='caminhao')return /[CDE]/.test(cat);return /[BCDE]/.test(cat);}
function validVehicle(v,service,passageiros=1,carga={},requestedType=null){return v?.status==='aprovado'&&(!v.crlvValidade||new Date(v.crlvValidade)>new Date())&&serviceVehicleCompatible(service,v.tipo)&&(!requestedType||v.tipo===requestedType)&&(!['frete_interestadual','frete_internacional'].includes(service)||Boolean(v.rntrc))&&(!service.startsWith('corrida')||v.lugares>passageiros)&&(!carga?.pesoKg||v.capacidadeKg>=carga.pesoKg)&&(!carga?.volumeM3||v.capacidadeM3>=carga.volumeM3);}
// Territory is checked via mobilidadePoliticaMoto.consultar at all mutation and dispatch entry points.
// This synchronous helper only deals with vehicle/profile compatibility.
function scopeAllowed(){return true;}
module.exports={fail,point,scope,serviceFor,fronteiraIntegrada,tarifaLocalidades,kilometers,route,price,validateCargo,validCnh,validVehicle,cnhSupportsVehicle,scopeAllowed,norm};
