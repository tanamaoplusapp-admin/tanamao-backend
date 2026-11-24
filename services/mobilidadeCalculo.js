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
function addressForRoute(p){
 const address=String(p?.endereco||'').trim();
 const city=String(p?.cidade||'').trim();
 if(!address || !city) return null;
 if(norm(address).includes(norm(city))) return address;
 const state=String(p?.uf||'').trim();
 const country=p?.pais==='PY'?'Paraguai':'Brasil';
 return [address,city,state,country].filter(Boolean).join(', ');
}
function parseGoogleRoute(data){
 const r=data?.routes?.[0];
 const meters=Number(r?.distanceMeters);
 if(!r || !Number.isFinite(meters) || meters<=0) return null;
 const durationSeconds=Number.parseFloat(String(r.duration||''));
 return {
  km:meters/1000,
  min:Math.max(1,Math.ceil((Number.isFinite(durationSeconds)?durationSeconds:0)/60)),
  method:'google_routes',
 };
}
async function route(a,b){
 const key=String(process.env.MOBILITY_GOOGLE_ROUTES_API_KEY||'').trim();
 const approx=approximateEnabled();
 if(key){
  if(kilometers(a,b)<0.015) fail(400,'Origem e destino estão no mesmo local. Selecione dois pontos diferentes.');
  async function query(origin,destination,kind){
   try{
    const {data}=await axios.post('https://routes.googleapis.com/directions/v2:computeRoutes',{
     origin,destination,travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',languageCode:'pt-BR'
    },{timeout:8500,headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration'}});
    return parseGoogleRoute(data);
   }catch(e){
    const status=e?.response?.status;
    // Apenas código HTTP/tipo da tentativa: nunca registrar chave, coordenadas ou endereços.
    console.warn('[mobilidade/cotacao/rota] Falha Google Routes',kind,status||e?.code||'erro');
    if(kind==='endereco' && (status===400 || status===404))return null;
    if(kind==='coordenadas' && (status===400 || status===404))return null;
    if(!approx)fail(503,'O serviço de rotas está indisponível. Tente novamente em instantes.');
    return null;
   }
  }
  const coords=(p)=>({location:{latLng:{latitude:p.lat,longitude:p.lng}}});
  const direct=await query(coords(a),coords(b),'coordenadas');
  if(direct)return direct;
  // O Google pode não encontrar acesso rodoviário ao ponto exato. Uma segunda
  // tentativa usa os endereços fornecidos, mas nunca inventa uma estimativa.
  const addressA=addressForRoute(a),addressB=addressForRoute(b);
  if(addressA && addressB && norm(addressA)!==norm(addressB)){
   const byAddress=await query({address:addressA},{address:addressB},'endereco');
   if(byAddress){
    // Evita cotar outra localidade quando um endereço textual é ambíguo.
    const straight=kilometers(a,b);
    if(byAddress.km<=Math.max(8,straight*8))return byAddress;
    console.warn('[mobilidade/cotacao/rota] Rota por endereco muito distante dos pontos selecionados');
   }
  }
  if(!approx){
   console.warn('[mobilidade/cotacao/rota] Sem trajeto dirigível entre os pontos selecionados');
   fail(422,'Não encontramos uma rota de carro entre esses pontos. Ajuste a origem e o destino no mapa.');
  }
 }
 if(!approx){
  console.warn('[mobilidade/cotacao/rota] Chave de rota ausente na execução');
  fail(503,'Cálculo de rotas temporariamente indisponível. Tente novamente.');
 }
 const km=Math.max(0.8,Math.round(kilometers(a,b)*1.3*100)/100);const speed=km>70?65:28;
 return {km,min:Math.max(3,Math.ceil(km/speed*60)),method:'aproximacao'};
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
