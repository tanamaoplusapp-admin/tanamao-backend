'use strict';
/**
 * Tanamao+ - tarifa nacional por UF, com excecoes verificadas por municipio.
 * Nunca consulta precos privados de Uber/99; os valores sao PROPOSTAS, nao tarifas oficiais.
 * Nao modifica as aprovacoes de cidades para passageiros por moto ou as de motoristas.
 *
 * node scripts/cadastrarTarifasBrasil.cjs --preview
 * node scripts/cadastrarTarifasBrasil.cjs --csv
 * node scripts/cadastrarTarifasBrasil.cjs --aplicar --banco=TaNaMaoPlus --confirmar=CADASTRAR_TARIFAS_ESTIMADAS
 * node scripts/cadastrarTarifasBrasil.cjs --aplicar --ativar-base --banco=TaNaMaoPlus --confirmar=CADASTRAR_TARIFAS_ESTIMADAS
 * node scripts/cadastrarTarifasBrasil.cjs --aplicar --atualizar-sementes-antigas --banco=TaNaMaoPlus --confirmar=CADASTRAR_TARIFAS_ESTIMADAS
 *
 * Por padrao, NAO se conecta ao MongoDB, NAO altera tarifas existentes e NAO ativa nada.
 * Para ativar novos cadastros basicos, use --ativar-base juntamente com --aplicar.
 */
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const REFERENCIA_GASOLINA_R = 6.47;
// Parametros escolhidos para Normal, calibrados em Ponta Pora (6,67 R$/L).
const REFERENCIA_NORMAL_R = 6.67;
const PERCENTUAL_COMFORT = 25; // Comfort usa markup no backend; nao cria um novo servico de tarifa.
const REFERENCIA_DIESEL_R = 7.29;
const PESQUISA = Object.freeze({
  precoCombustivelPeriodo: '15/11/2026 a 21/11/2026',
  precoCombustivelFonte: 'https://www.gasoradar.com.br/preco-gasolina',
  fontePrimaria: 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas',
  fonteMunicipios: 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios',
  fonteDiesel: 'https://www.gasoradar.com.br/preco-diesel',
  periodoDiesel: '08/11/2026 a 14/11/2026',
});

// Combustivel (R$/litro), media estadual ANP, 15-21/11/2026, reproduzida pelo GasoRadar.
// NAO sao tarifas de corridas. Sao apenas um dos parametros usados nas estimativas.
const GAS_UF = Object.freeze({
  AC:7.40, AL:6.57, AP:6.40, AM:6.58, BA:6.64, CE:6.88, DF:6.54,
  ES:6.43, GO:6.58, MA:6.34, MT:6.70, MS:6.40, MG:6.37, PA:6.49,
  PB:6.25, PR:6.55, PE:6.70, PI:6.56, RJ:6.60, RN:6.24, RS:6.09,
  RO:7.42, RR:7.57, SC:6.28, SP:6.36, SE:6.91, TO:6.87,
});

// Diesel S10 estadual, 08/11 a 14/11/2026, ANP reproduzida pelo GasoRadar.
// Valor e periodo diferem da gasolina, como declarado nas fontes.
const DIESEL_UF = Object.freeze({
 AC:8.17, AL:7.30, AP:7.26, AM:7.09, BA:7.59, CE:7.29, DF:7.35,
 ES:6.97, GO:7.20, MA:7.41, MT:7.52, MS:7.32, MG:7.04, PA:7.48,
 PB:7.24, PR:7.31, PE:7.12, PI:7.67, RJ:7.13, RN:7.36, RS:7.11,
 RO:7.48, RR:7.63, SC:7.20, SP:7.31, SE:7.34, TO:7.33,
});

// ANP pesquisa somente alguns municipios de MS. Esses cinco valores sao uma
// referencia local de CUSTO, nao uma tabela de corridas encontrada na cidade.
// Fonte: https://www.noticiasautomotivas.com.br/preco-dos-combustiveis/mato-grosso-do-sul/
const GAS_CIDADE = Object.freeze({
  'MS:campo grande':6.25,
  'MS:dourados':6.67,
  'MS:tres lagoas':6.49,
  'MS:corumba':6.97,
  'MS:ponta pora':6.67,
});
// Diesel S10 nesses municipios, mesma publicacao de 15-21/11.
// Corumba nao apresentou amostra suficiente; usa-se a media de MS.
const DIESEL_CIDADE = Object.freeze({
  'MS:campo grande':7.26,
  'MS:dourados':7.41,
  'MS:tres lagoas':7.39,
  'MS:ponta pora':7.78,
});

// Corrida Normal definida pelo usuario: R$3,50 base + R$1,60/km + R$0,15/min, minimo R$8,90.
// Somente o km sofre ajuste suave regional; minimo/base/minuto sao iguais no Brasil.
// Demais modalidades sao mantidas como no script anterior ate revisao especifica.
// Nao sao valores oficiais de concorrentes ou do poder publico.
// [servico, bandeirada, porKm, porMinuto, minimo]
const BASE = Object.freeze([
  ['corrida_carro',350,160,15,890],
  ['corrida_moto',290,125,12,790],
  ['entrega_carro',590,185,16,1290],
  ['entrega_moto',340,120,10,790],
  ['frete_local',1190,250,18,1990],
  ['frete_intermunicipal',1800,290,0,2990],
  ['frete_interestadual',3200,400,0,5900],
  ['frete_internacional',2200,310,0,3200],
]);
// Ativar a tarifa de moto nao habilita uma cidade: a regra territorial de moto
// continua bloqueada ate aprovacao MANUAL no painel (politica da localidade).
const SERVICOS_ATIVAVEIS = new Set([
  'corrida_carro','corrida_moto','entrega_carro','entrega_moto','frete_local',
]);
const CONFIRMACAO = 'CADASTRAR_TARIFAS_ESTIMADAS';

function normalizarCidade(s){
 return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
function fatorCombustivel(valor,mediaNacional=REFERENCIA_GASOLINA_R){
 assert(Number.isFinite(valor) && valor>0 && mediaNacional>0,'Preco de combustivel invalido');
 return Math.min(1.20,Math.max(0.90,valor/mediaNacional));
}
function usaDiesel(servico){return servico.startsWith('frete_');}
function precoCombustivel(uf,cidade='*',servico='corrida_carro'){
 if(!Object.hasOwn(GAS_UF,uf))throw new Error(`UF fora da pesquisa: ${uf}`);
 const diesel=usaDiesel(servico);
 const local=(diesel?DIESEL_CIDADE:GAS_CIDADE);
 const estados=(diesel?DIESEL_UF:GAS_UF);
 return local[`${uf}:${normalizarCidade(cidade)}`]??estados[uf];
}
function origemCusto(uf,cidade,servico){
 const local=(usaDiesel(servico)?DIESEL_CIDADE:GAS_CIDADE);
 return Object.hasOwn(local,`${uf}:${normalizarCidade(cidade)}`)?'ANP_municipio':'ANP_UF';
}
function fatorCorridaNormal(uf,cidade){
 // Para cidades sem levantamento local, usa a referencia de gasolina da UF.
 // Limites pequenos reduzem distorcao: combustivel NAO e tabela de precos de apps.
 return Math.min(1.08,Math.max(0.94,precoCombustivel(uf,cidade,'corrida_carro')/REFERENCIA_NORMAL_R));
}
function tarifa(servico,uf,cidade,{ativarBase=false}={}){
 const def=BASE.find(x=>x[0]===servico);
 if(!def)throw new Error('Servico inexistente: '+servico);
 const diesel=usaDiesel(servico);
 const f=servico==='corrida_carro'?fatorCorridaNormal(uf,cidade):
    fatorCombustivel(precoCombustivel(uf,cidade,servico),diesel?REFERENCIA_DIESEL_R:REFERENCIA_GASOLINA_R);
 const mult=n=>Math.round(n*f);
 return {
  servico,uf,cidade:normalizarCidade(cidade),
  bandeiradaCentavos:servico==='corrida_carro'?350:mult(def[1]),
  porKmCentavos:mult(def[2]),
  porMinutoCentavos:servico==='corrida_carro'?15:mult(def[3]),
  minimoCentavos:servico==='corrida_carro'?890:mult(def[4]),
  porKgCentavos:0,porM3Centavos:0,
  dinamicaAtiva:false,
  ativo:ativarBase&&SERVICOS_ATIVAVEIS.has(servico),
 };
}
// Somente usado para comparar dados da semente nacional antiga quando
// --atualizar-sementes-antigas for explicitamente informado. Nunca usa
// esta funcao para gerar novos precos.
function tarifaNacionalAnterior(servico,uf,cidade){
 const anterior=[490,195,20,1290];
 const f=fatorCombustivel(precoCombustivel(uf,cidade,servico),REFERENCIA_GASOLINA_R);
 return Object.fromEntries(['bandeiradaCentavos','porKmCentavos','porMinutoCentavos','minimoCentavos']
    .map((k,i)=>[k,Math.round(anterior[i]*f)]));
}
function tarifaLocalInicialAnterior(servico,uf,cidade){
 if(servico!=='corrida_carro'||uf!=='MS'||normalizarCidade(cidade)!=='ponta pora')return null;
 return {bandeiradaCentavos:490,porKmCentavos:195,porMinutoCentavos:20,minimoCentavos:1290};
}
function simularComfort(t,km=5,min=10){
 const normal=simulacao(t,km,min);
 return normal+Math.round(normal*PERCENTUAL_COMFORT/100);
}

function tarifasParaTodasCidades({ativarBase=false}={}){
 const rows=[];
 for(const uf of Object.keys(GAS_UF).sort()){
  for(const [servico] of BASE)rows.push(tarifa(servico,uf,'*',{ativarBase}));
 }
 for(const chave of Object.keys(GAS_CIDADE).sort()){
  const [uf,cidade]=chave.split(':');
  for(const [servico] of BASE)rows.push(tarifa(servico,uf,cidade,{ativarBase}));
 }
 return rows;
}
// Reflete a ordem real do backend: cidade/UF -> */UF -> */*.
function obterTarifaAplicavel(servico,uf,cidade,{ativarBase=false}={}){
 const city=normalizarCidade(cidade);
 const spec=Object.hasOwn(GAS_CIDADE,`${uf}:${city}`)?city:'*';
 return tarifa(servico,uf,spec,{ativarBase});
}
function moeda(n){return `R$ ${(n/100).toFixed(2).replace('.',',')}`;}
function simulacao(t,km=5,min=10){
 return Math.max(t.minimoCentavos,t.bandeiradaCentavos+Math.ceil(km*t.porKmCentavos)+Math.ceil(min*t.porMinutoCentavos));
}
function validarDados(rows){
 assert.equal(Object.keys(GAS_UF).length,27,'Ausencia de alguma UF');
 assert.equal(Object.keys(DIESEL_UF).length,27,'Ausencia de diesel de alguma UF');
 assert.equal(BASE.length,8);
 assert.equal(rows.length,(27+5)*8);
 const indices=new Set();
 for(const row of rows){
  const k=`${row.servico}/${row.uf}/${row.cidade}`;
  assert(!indices.has(k),`Tarifa duplicada: ${k}`); indices.add(k);
  for(const key of ['bandeiradaCentavos','porKmCentavos','porMinutoCentavos','minimoCentavos'])
   assert(Number.isSafeInteger(row[key])&&row[key]>=0,`Valor invalido em ${k}`);
  assert(row.porKmCentavos>0&&row.minimoCentavos>=0);
 }
 return true;
}
function nomeUF(m){
 return m?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
   ||m?.microrregiao?.mesorregiao?.UF?.sigla||m?.UF?.sigla||m?.uf||null;
}
function obterUrl(url,depth=0){
 if(depth>3)return Promise.reject(new Error('Muitos redirects do IBGE'));
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{timeout:20000,headers:{Accept:'application/json','Accept-Encoding':'gzip,deflate','User-Agent':'TanamaoTarifas/2026 (dados publicos)'}},res=>{
   if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();resolve(obterUrl(new URL(res.headers.location,url).toString(),depth+1));return;}
   if(res.statusCode!==200){res.resume();reject(new Error(`IBGE HTTP ${res.statusCode}`));return;}
   const buf=[];let tamanho=0;
   res.on('data',c=>{tamanho+=c.length;if(tamanho>18*1024*1024){req.destroy(new Error('JSON acima do limite'));return;}buf.push(c);});
   res.on('end',()=>{
    try{
     let bytes=Buffer.concat(buf);const enc=res.headers['content-encoding']||'';
     if(enc.includes('gzip'))bytes=zlib.gunzipSync(bytes);
     else if(enc.includes('deflate'))bytes=zlib.inflateSync(bytes);
     resolve(JSON.parse(bytes.toString('utf8')));
    }catch(e){reject(new Error('JSON do IBGE invalido: '+e.message));}
   });
   res.on('error',reject);
  });
  req.on('timeout',()=>req.destroy(new Error('Tempo excedido consultando IBGE')));
  req.on('error',reject);
 });
}
function municipioParaRegistro(raw){
 const id=String(raw?.id||'');const uf=nomeUF(raw);const cidade=normalizarCidade(raw?.nome);
 if(!/^\d{7}$/.test(id)||!uf||!Object.hasOwn(GAS_UF,uf)||!cidade)throw new Error(`Dados IBGE invalidos: ${id} ${uf} ${cidade}`);
 return {id,uf,cidade,nome:raw.nome};
}
async function municipiosIBGE(){
 const a=await obterUrl(PESQUISA.fonteMunicipios);
 if(!Array.isArray(a)||a.length<5500)throw new Error('IBGE retornou lista incompleta. Nada sera cadastrado a partir desse arquivo.');
 const rows=a.map(municipioParaRegistro);
 if(new Set(rows.map(m=>m.id)).size!==rows.length)throw new Error('Lista do IBGE contem codigos duplicados');
 return rows.sort((a,b)=>a.uf.localeCompare(b.uf)||a.cidade.localeCompare(b.cidade));
}
function csvEsc(str){const s=String(str??'');return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function gravarCSV(municipios,{ativarBase=false,arquivo}={}){
 const dest=arquivo||path.resolve(process.cwd(),'relatorios/tarifas_municipios_2026.csv');
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 const fd=fs.openSync(dest,'w');let count=0;
 try{
  fs.writeSync(fd,'\uFEFFibge;cidade;uf;servico;bandeirada_centavos;por_km_centavos;por_minuto_centavos;minimo_centavos;ativo_proposto;referencia_custo;tipo_valor\n');
  for(const m of municipios){
   for(const [servico] of BASE){
    const row=obterTarifaAplicavel(servico,m.uf,m.cidade,{ativarBase});
    const col=[m.id,m.nome,m.uf,servico,row.bandeiradaCentavos,row.porKmCentavos,row.porMinutoCentavos,row.minimoCentavos,row.ativo,origemCusto(m.uf,m.cidade,servico),'ESTIMATIVA_NAO_OFICIAL'];
    fs.writeSync(fd,col.map(csvEsc).join(';')+'\n');count++;
   }
  }
 } finally {fs.closeSync(fd);}
 return {dest,count};
}
function verPreview(rows){
 console.log('Tarifas por UF e por cinco municipios de MS:',rows.length,'registros (8 modalidades)');
 console.log('Estado e municipio sem cadastro especifico recebem a tarifa da UF (cidade="*").');
 console.log('Valores PROPOSTOS: Normal minimo R$8,90; Comfort = Normal +25% onde estiver habilitado.');
 console.log('Ativas:',rows.filter(x=>x.ativo).length,'; nao sobrescreve tarifas ja cadastradas por padrao.');
 const samples=[['MS','ponta pora'],['MS','campo grande'],['MS','dourados'],['SP','sao paulo'],['RJ','rio de janeiro'],['RR','boa vista']];
 for(const [uf,cidade] of samples){
  const t=obterTarifaAplicavel('corrida_carro',uf,cidade,{ativarBase:rows[0]?.ativo});
  console.log(`${cidade}/${uf} | Normal: ${moeda(t.bandeiradaCentavos)} base + ${moeda(t.porKmCentavos)}/km + ${moeda(t.porMinutoCentavos)}/min | minimo ${moeda(t.minimoCentavos)} | 5km/10min ${moeda(simulacao(t))} | Comfort 25%: ${moeda(simularComfort(t))}`);
 }
}
async function cadastrarMongo(rows,{dbExpected,confirmacao,atualizarSementesAntigas=false}={}){
 if(confirmacao!==CONFIRMACAO)throw new Error(`Para gravar, informe --confirmar=${CONFIRMACAO}`);
 if(!dbExpected)throw new Error('Informe --banco=NOME_EXATO_DO_BANCO para impedir gravacao em banco errado');
 const uri=process.env.MONGODB_URI||process.env.MONGO_URI;
 if(!uri)throw new Error('MONGO_URI ou MONGODB_URI ausente; execute dentro do backend com as variaveis configuradas');
 const mongoose=require('mongoose');
 const Tariff=require('../models/MobilidadeTarifa');
 try{
  await mongoose.connect(uri,{dbName:process.env.MONGO_DB_NAME||undefined,serverSelectionTimeoutMS:15000});
  const dbName=mongoose.connection.db.databaseName;
  if(dbName!==dbExpected)throw new Error(`Banco conectado ${dbName}; esperado ${dbExpected}. Nenhuma tarifa gravada.`);
  console.log('Banco verificado:',dbName);
  // Verifica indice sem remover/alterar outros. Evita duplicatas de novas tarifas.
  const existing=await Tariff.collection.listIndexes().toArray().catch(e=>{
   if(e.codeName==='NamespaceNotFound')return []; throw e;
  });
  const eqKey=ind=>JSON.stringify(ind.key)===JSON.stringify({servico:1,uf:1,cidade:1});
  const same=existing.find(eqKey);
  if(same&&!same.unique)throw new Error('Indice de tarifas existente NAO e unico. Corrija no MongoDB antes de inserir; nenhuma tarifa gravada.');
  if(!same)await Tariff.collection.createIndex({servico:1,uf:1,cidade:1},{unique:true});
  let created=0,already=0,revised=0;
  for(let at=0;at<rows.length;at+=100){
   const chunk=rows.slice(at,at+100);
   const ops=chunk.map(row=>({updateOne:{filter:{servico:row.servico,uf:row.uf,cidade:row.cidade},update:{$setOnInsert:row},upsert:true}}));
   const out=await Tariff.bulkWrite(ops,{ordered:true});
   created+=out.upsertedCount??0;
   already+=chunk.length-(out.upsertedCount??0);
  }
  // Atualizacao OPCIONAL SOMENTE para o valor exato do script nacional anterior.
  // Nao modifica tarifas editadas pelo painel (alteradoPor) nem valores diferentes.
  // Inclui a semente local inicial de Ponta Pora (4,90/1,95/0,20/12,90).
  // Mantem o atributo `ativo` e todas as permissoes existentes.
  if(atualizarSementesAntigas){
   for(const row of rows.filter(r=>r.servico==='corrida_carro')){
    const anteriores=[tarifaNacionalAnterior(row.servico,row.uf,row.cidade),tarifaLocalInicialAnterior(row.servico,row.uf,row.cidade)].filter(Boolean);
    for(const anterior of anteriores){
     const out=await Tariff.updateOne({servico:row.servico,uf:row.uf,cidade:row.cidade,
       alteradoPor:null,...anterior},{$set:{
       bandeiradaCentavos:row.bandeiradaCentavos,porKmCentavos:row.porKmCentavos,
       porMinutoCentavos:row.porMinutoCentavos,minimoCentavos:row.minimoCentavos
     }});
     revised+=out.modifiedCount||0;
    }
   }
  }
  console.log(`CONCLUIDO: ${created} tarifas novas; ${already} ja existentes; ${revised} sementes antigas de carro Normal atualizadas.`);
  console.log('Aprovacoes de moto/cidades/motoristas NAO foram alteradas.');
  return {created,already,revised};
 }finally{await mongoose.disconnect();}
}
function flags(argv){
 const set=new Set(argv);
 const named=prefix=>argv.find(x=>x.startsWith(prefix))?.slice(prefix.length)||null;
 const aplicar=set.has('--aplicar');
 const ativarBase=set.has('--ativar-base');
 const csv=set.has('--csv');
 const atualizarSementesAntigas=set.has('--atualizar-sementes-antigas');
 if(atualizarSementesAntigas&&!aplicar)throw new Error('--atualizar-sementes-antigas exige --aplicar');
 if(ativarBase&&!aplicar)throw new Error('--ativar-base exige --aplicar');
 if(aplicar&&!named('--confirmar='))throw new Error(`Confirme --confirmar=${CONFIRMACAO}`);
 return {aplicar,ativarBase,csv,atualizarSementesAntigas,dbExpected:named('--banco='),confirmacao:named('--confirmar=')};
}
async function main(){
 // Deixa carregar .env local se ja presente. No Render, variaveis sao providas pelo servico.
 try{require('dotenv').config({quiet:true});}catch{}
 const opt=flags(process.argv.slice(2));
 const rows=tarifasParaTodasCidades({ativarBase:opt.ativarBase});validarDados(rows);
 verPreview(rows);
 if(opt.csv){const m=await municipiosIBGE();const {dest,count}=gravarCSV(m,{ativarBase:opt.ativarBase});console.log(`CSV: ${dest} (${m.length} municipios, ${count} linhas)`);}
 if(opt.aplicar)await cadastrarMongo(rows,opt);
 if(!opt.aplicar&&!opt.csv)console.log('PREVIEW: Nenhuma alteracao realizada. Use --csv e/ou --aplicar para continuar.');
}
if(require.main===module)main().catch(e=>{console.error('FALHA:',e.message);process.exitCode=1;});
module.exports={GAS_UF,GAS_CIDADE,DIESEL_UF,DIESEL_CIDADE,BASE,PERCENTUAL_COMFORT,SERVICOS_ATIVAVEIS,CONFIRMACAO,normalizarCidade,fatorCombustivel,fatorCorridaNormal,precoCombustivel,tarifa,tarifaNacionalAnterior,tarifaLocalInicialAnterior,tarifasParaTodasCidades,obterTarifaAplicavel,simulacao,simularComfort,validarDados,municipioParaRegistro,gravarCSV,flags,PESQUISA};
