'use strict';
// Registry hybrid: automatic discovery, human review based on official documents.
// Search snippets, social profiles and advertisements NEVER authorize a locality.
const Model = require('../models/MobilidadePermissaoMoto');
const {error} = require('../middleware/mobilidade');
const PONTA_LAW = 'https://server2.pontapora.ms.gov.br/diarios-2020a2024/DIARIOOFICIAL08DEOUTUBRODE2020.pdf';
const PONTA_NOTE = 'Lei Municipal 4.441/2020, art. 16: proibicao expressa de cadastrar motocicletas em plataformas abrangidas. Necessaria confirmacao de eventual alteracao ou revogacao junto ao municipio.';
const STATUS = Object.freeze(['pendente','autorizado','restrito']);
function cleanCity(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim().replace(/\s+/g,' ').slice(0,80);
}
const upper = value => String(value || '').trim().toUpperCase();
function normalizePlace(place) {
  const cidade = String(place?.cidade || '').trim().slice(0,80);
  const cidadeNormalizada = cleanCity(cidade);
  const uf = upper(place?.uf);
  // Paraguay local geocoding stores uf=PY; for BR the UF is the state.
  const pais = upper(place?.pais || (uf === 'PY' ? 'PY' : 'BR'));
  if (!cidadeNormalizada || !/^[A-Z]{2}$/.test(uf) || !/^[A-Z]{2}$/.test(pais)) {
    error(400,'Nao foi possivel identificar cidade, regiao e pais da origem. Escolha novamente o embarque.');
  }
  if (pais !== 'BR' && uf !== pais) error(400,'Pais e regiao do ponto de embarque nao conferem.');
  return {cidade,cidadeNormalizada,uf,pais,chave:`${pais}|${uf}|${cidadeNormalizada}`};
}
function knownRestriction(p) {return p.pais==='BR' && p.uf==='MS' && p.cidadeNormalizada==='ponta pora';}
function startingRecord(place) {
  const known=knownRestriction(place);
  return {
    ...place, status:known?'restrito':'pendente',
    fundamento:known?PONTA_NOTE:'Cidade identificada automaticamente. Aguardando verificacao documental no painel.',
    fonteOficial:known?PONTA_LAW:'',
    analisadoEm:known?new Date('2026-11-23T00:00:00.000Z'):null,
    analisarNovamenteEm:null,
    identificadaEm:new Date(),
  };
}
function effective(record, now = new Date()) {
  const p=normalizePlace(record);
  const expired=record.status==='autorizado' && (!record.analisarNovamenteEm || new Date(record.analisarNovamenteEm)<=now);
  const globallyOff=process.env.MOBILITY_MOTO_PASSENGER_ENABLED==='false';
  let situacao=globallyOff?'desativado_globalmente':expired?'revisao_vencida':record.status;
  const permitida=!globallyOff && !expired && record.status==='autorizado';
  const localidade=[p.cidade,p.uf===p.pais?null:p.uf,p.pais].filter(Boolean).join(' - ');
  const mensagem=globallyOff
    ? 'Corridas de passageiros por moto estao desativadas temporariamente no Tanamao+.'
    : situacao==='autorizado'
      ? `Corridas de moto estao habilitadas em ${localidade}, para motoristas aprovados.`
      : situacao==='restrito'
        ? `Corridas por moto indisponiveis em ${localidade}: foi identificada uma restricao na legislacao local. Consulte o painel de Mobilidade.`
        : situacao==='revisao_vencida'
          ? `Corridas por moto aguardam nova revisao da autorizacao para ${localidade}. Tente corrida de carro.`
          : `Corridas por moto em ${localidade} aguardam verificacao das regras locais. Carro e entregas continuam disponiveis.`;
  return {permitida,situacao,codigo:permitida?'AUTORIZADA':'NAO_HABILITADA',mensagem,
    cidade:p.cidade,uf:p.uf,pais:p.pais,
    revisarEm:record.analisarNovamenteEm||null,
    verificadoEm:record.analisadoEm||null};
}
async function consultar(origem,{registrar=true,now=new Date()}={}) {
  const p=normalizePlace(origem);
  let record;
  if(registrar){
    // Upsert is idempotent across concurrent travelers; does not reset an admin decision.
    try {
      record=await Model.findOneAndUpdate({chave:p.chave},
        {$setOnInsert:startingRecord(p),$set:{consultadaEm:now},$inc:{consultas:1}},
        {upsert:true,new:true,setDefaultsOnInsert:true,runValidators:true}).lean();
    } catch(e) {
      if(e.code!==11000)throw e;
      record=await Model.findOne({chave:p.chave}).lean();
    }
  }else record=await Model.findOne({chave:p.chave}).lean();
  return effective(record || startingRecord(p),now);
}
function checkSourceUrl(raw) {
  const candidate=String(raw||'').trim();
  if(candidate.length>800)error(400,'Fonte muito longa.');
  try { const url=new URL(candidate);if(url.protocol!=='https:'||url.username||url.password||!url.hostname||!/(^|\.)(gov\.br|gov\.py|jus\.br|leg\.br|gob\.[a-z.]+|gov)$/.test(url.hostname.toLowerCase()))throw new Error('url'); return url.href; }
  catch {error(400,'Use o link HTTPS de fonte publica oficial (ex.: gov.br, gov.py, jus.br).');}
}
function validateDecision(body, record, now=new Date()) {
  const status=String(body?.status||'').trim();
  if(!STATUS.includes(status))error(400,'Situacao invalida: pendente, autorizado ou restrito.');
  const fundamento=String(body?.fundamento||'').trim().slice(0,1200);
  if(fundamento.length<30)error(400,'Registre o fundamento e a justificativa (ao menos 30 caracteres).');
  const fonteOficial=body?.fonteOficial?checkSourceUrl(body.fonteOficial):'';
  if(status!=='pendente'&&!fonteOficial)error(400,'Inclua a fonte legal oficial para autorizar ou restringir uma localidade.');
  if(status==='autorizado'&&body?.confirmouAnalise!==true)
    error(400,'Confirme a verificacao documental e as autorizacoes aplicaveis.');
  if(status==='autorizado'&&knownRestriction(normalizePlace(record))&&body?.confirmacaoAtualizacaoLei!=='CONFIRMO_REVOGACAO_ART16')
    error(409,'Ponta Pora: a Lei 4.441/2020 art. 16 indica restricao. Para alterar, confirme expressamente a norma posterior que a revogou, com link oficial e fundamento.');
  let analisarNovamenteEm=null;
  if(status==='autorizado'){
    const d=new Date(body?.analisarNovamenteEm);
    const days=(d.getTime()-now.getTime())/86400000;
    if(!Number.isFinite(days)||days<1||days>366)error(400,'Defina revisao futura entre 1 e 366 dias para autorizacoes.');
    analisarNovamenteEm=d;
  }
  return {status,fundamento,fonteOficial,analisarNovamenteEm};
}
async function revisar(chave,body,adminId) {
  const doc=await Model.findOne({chave:String(chave||'').trim()});
  if(!doc)error(404,'Localidade nao encontrada. Ela sera cadastrada quando houver a primeira consulta de embarque.');
  const decision=validateDecision(body,doc);
  const statusAnterior=doc.status;
  const h={statusAnterior,statusNovo:decision.status,fundamento:decision.fundamento,
    fonteOficial:decision.fonteOficial,em:new Date(),por:adminId};
  // CAS avoids silently overwriting a concurrent administrative review.
  const updated=await Model.findOneAndUpdate({_id:doc._id,status:doc.status,analisadoEm:doc.analisadoEm||null},
    {$set:{...decision,analisadoEm:new Date(),analisadoPor:adminId},$push:{historico:{$each:[h],$slice:-30}}},
    {new:true,runValidators:true}).lean();
  if(!updated)error(409,'Outra revisao alterou esta cidade. Atualize a lista antes de salvar.');
  return updated;
}
module.exports={consultar,revisar,normalizePlace,startingRecord,effective,validateDecision,checkSourceUrl,knownRestriction,PONTA_LAW,PONTA_NOTE};
