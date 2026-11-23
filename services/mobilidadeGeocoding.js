'use strict';
// Antes de cobrar tarifas reais ou aplicar regra municipal, confirma a UF/cidade
// dos pontos no servidor. Evita confiar apenas nos campos escritos pelo cliente.
// No beta com rota aproximada e whitelist, a verificacao e dispensada para testes.
const axios=require('axios');
const {approximateEnabled}=require('../config/mobilidade');
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
async function validarLocalidade(ponto){
 if(approximateEnabled())return ponto; // Modo de teste restrito, NAO comercial.
 const key=process.env.MOBILITY_GOOGLE_GEOCODING_API_KEY||process.env.MOBILITY_GOOGLE_ROUTES_API_KEY;
 if(!key)fail(503,'Verificacao de cidades indisponivel. Configure Geocoding API para rotas reais');
 let data;
 try{
  ({data}=await axios.get('https://maps.googleapis.com/maps/api/geocode/json',{timeout:7000,params:{latlng:`${ponto.lat},${ponto.lng}`,key,language:'pt-BR'}}));
 }catch{fail(503,'Nao foi possivel verificar a localidade do trajeto');}
 if(data?.status!=='OK'||!Array.isArray(data.results)||!data.results.length)fail(503,'Geocoding retornou localidade indisponivel');
 const candidates = data.results.map(r=>r.address_components||[]);
 const pickFrom=(parts,type)=>parts.find(c=>(c.types||[]).includes(type));
 const parts = candidates.find(p=>pickFrom(p,'country') && (pickFrom(p,'locality')||pickFrom(p,'administrative_area_level_2'))) || candidates[0];
 const pick=type=>pickFrom(parts,type);
 const country=String(pick('country')?.short_name||'').trim().toUpperCase();
 const city=String(pick('locality')?.long_name||pick('postal_town')?.long_name||pick('administrative_area_level_2')?.long_name||'').trim();
 const state=String(pick('administrative_area_level_1')?.short_name||'').trim().toUpperCase();
 if(!country||!city)fail(503,'Pais ou cidade nao identificados nas coordenadas');
 const declaredCountry=String(ponto.pais||'BR').toUpperCase();
 if(country!==declaredCountry||normalize(city)!==normalize(ponto.cidade))
  fail(400,'Pais ou cidade nao conferem com as coordenadas. Selecione novamente o endereco');
 if(country==='BR'&&state!==ponto.uf)fail(400,'Estado nao confere com as coordenadas. Selecione novamente o endereco');
 if(country!=='BR'&&ponto.uf!==country)fail(400,'Pais nao confere com as coordenadas. Selecione novamente o endereco');
 return ponto;
}
module.exports={validarLocalidade};
