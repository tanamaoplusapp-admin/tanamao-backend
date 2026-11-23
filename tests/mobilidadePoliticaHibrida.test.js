'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),data=new Map();let sequence=0;
const Model={
 findOneAndUpdate(q,u){if(u.$setOnInsert){let row=data.get(q.chave)||{...u.$setOnInsert,_id:`r${++sequence}`,historico:[]};row={...row,...u.$set,consultas:(row.consultas||0)+1};data.set(q.chave,row);return {lean:async()=>row};}
 const row=[...data.values()].find(x=>x._id===q._id&&x.status===q.status&&String(x.analisadoEm||null)===String(q.analisadoEm||null));
 if(!row)return {lean:async()=>null};const next={...row,...u.$set,historico:[...row.historico,...u.$push.historico.$each]};data.set(row.chave,next);return {lean:async()=>next};},
 findOne(q){return {lean:async()=>data.get(q.chave)||null,then:f=>f(data.get(q.chave)||null)};}
};
const mod={exports:{}};
const src=fs.readFileSync(path.join(root,'services/mobilidadePoliticaMoto.js'),'utf8');
vm.runInThisContext('(function(require,module,exports,process){'+src+'\n})')((name)=>{
 if(name==='../models/MobilidadePermissaoMoto')return Model;
 if(name==='../middleware/mobilidade')return {error:(status,message)=>{throw Object.assign(new Error(message),{status});}};
 throw Error('Unmocked '+name);
},mod,mod.exports,process);
const Policy=mod.exports;
const ponta={cidade:'Ponta Por\u00e3',uf:'MS',pais:'BR'},pedro={cidade:'Pedro Juan Caballero',uf:'PY',pais:'PY'},other={cidade:'Cidade Teste',uf:'MS',pais:'BR'};
const source=Policy.PONTA_LAW,note='A fonte oficial foi verificada e todos os requisitos da modalidade foram analisados.';
test('deduplicates accents and isolates countries',()=>{
 assert.equal(Policy.normalizePlace(ponta).chave,'BR|MS|ponta pora');
 assert.equal(Policy.normalizePlace({...ponta,cidade:'PONTA PORA'}).chave,'BR|MS|ponta pora');
 assert.notEqual(Policy.normalizePlace(pedro).chave,Policy.normalizePlace({...pedro,pais:'BR'}).chave);
});
test('autodiscovery keeps Ponta restricted and Pedro pending',async()=>{
 const a=await Policy.consultar(ponta),b=await Policy.consultar(pedro);
 assert.equal(a.situacao,'restrito');assert.equal(a.permitida,false);assert.equal(b.situacao,'pendente');
 assert.equal(data.get('BR|MS|ponta pora').fonteOficial,source);
});
test('automatic discovery stores no address or precise user coordinates',async()=>{
 await Policy.consultar({...other,endereco:'Private road 123',lat:-22,lng:-55});
 const row=data.get('BR|MS|cidade teste');assert.equal(row.status,'pendente');
 assert.equal(JSON.stringify(row).includes('Private road'),false);
});
test('official sources required, search engine and unsafe URLs rejected',()=>{
 assert.equal(Policy.checkSourceUrl(source),source);
 for(const u of ['https://google.com/search?q=moto','http://pontapora.ms.gov.br','https://fakegov.br','https://gov.br.evil.com'])
  assert.throws(()=>Policy.checkSourceUrl(u),{status:400});
});
test('cannot authorize unknown city without review proof or Ponta without repeal attestation',()=>{
 const row=Policy.startingRecord(Policy.normalizePlace(other));
 assert.throws(()=>Policy.validateDecision({status:'autorizado',fundamento:note,fonteOficial:source,analisarNovamenteEm:'2027-02-01'},row),{status:400});
 const p=Policy.startingRecord(Policy.normalizePlace(ponta));
 assert.throws(()=>Policy.validateDecision({status:'autorizado',fundamento:note,fonteOficial:source,analisarNovamenteEm:'2027-02-01',confirmouAnalise:true},p),{status:409});
});
test('authorizations expire automatically and global emergency switch wins',()=>{
 const row={...Policy.startingRecord(Policy.normalizePlace(other)),status:'autorizado',analisarNovamenteEm:new Date('2027-02-01')};
 const saved=process.env.MOBILITY_MOTO_PASSENGER_ENABLED;delete process.env.MOBILITY_MOTO_PASSENGER_ENABLED;
 assert.equal(Policy.effective(row,new Date('2026-11-23')).permitida,true);
 assert.equal(Policy.effective(row,new Date('2027-02-02')).situacao,'revisao_vencida');
 process.env.MOBILITY_MOTO_PASSENGER_ENABLED='false';assert.equal(Policy.effective(row,new Date('2026-11-23')).permitida,false);
 if(saved===undefined)delete process.env.MOBILITY_MOTO_PASSENGER_ENABLED;else process.env.MOBILITY_MOTO_PASSENGER_ENABLED=saved;
});
test('admin review authorizes and audits previously discovered city',async()=>{
 const p=Policy.normalizePlace(other),days=Date.now()+50*86400000;
 const row=await Policy.revisar(p.chave,{status:'autorizado',fundamento:note,fonteOficial:source,
   analisarNovamenteEm:new Date(days).toISOString(),confirmouAnalise:true},'admin123');
 assert.equal(row.status,'autorizado');assert.equal(row.historico.length,1);
 assert.equal((await Policy.consultar(other)).permitida,process.env.MOBILITY_MOTO_PASSENGER_ENABLED!=='false');
});
test('moto origin policy gates quote, booking, driver accept, dispatch and discovery',()=>{
 const controller=fs.readFileSync(path.join(root,'controllers/mobilidadeController.js'),'utf8');
 const dispatcher=fs.readFileSync(path.join(root,'services/mobilidadeDespacho.js'),'utf8');
 const discover=fs.readFileSync(path.join(root,'services/mobilidadeCandidatos.js'),'utf8');
 assert.ok((controller.match(/PoliticaMoto\.consultar/g)||[]).length>=4);
 assert.match(dispatcher,/PoliticaMoto\.consultar\(job\.origem\)/);
 assert.match(discover,/PoliticaMoto\.consultar\(job\.origem\)/);
 assert.match(fs.readFileSync(path.join(root,'routes/mobilidadeAdminRoutes.js'),'utf8'),/permissoes-moto/);
});
