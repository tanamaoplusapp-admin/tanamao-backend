const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Isola a funcao real de transicao do controller. Nao exige credenciais,
// MongoDB, GPS ou dados de producao para validar a regra de estados.
const source = fs.readFileSync(path.join(__dirname, '../controllers/mobilidadeController.js'), 'utf8');
const begin = source.indexOf('async function tripTransition(req,res,phase){');
const end = source.indexOf('\nconst startTrip=', begin);
assert(begin >= 0 && end > begin);
const code = source.slice(begin, end);

function setup(startStatus) {
  let status = startStatus;
  let freed = 0;
  const emissions = [];
  const aud = [];
  const fakeJob = { _id: 'job-1', clienteId: 'client-1', motoristaId: 'driver-1', status };
  const unauthorized = Object.assign(new Error('Not assigned'), { status: 404 });
  const assignedJob = async (_req, expected) => {
    if (_req.userId !== 'driver-1') throw unauthorized;
    if (!expected.includes(status)) throw Object.assign(new Error('Invalid transition'), { status: 409 });
    return { ...fakeJob, status };
  };
  const Job = {findOneAndUpdate: async (filter, update) => {
    if (filter.motoristaId !== 'driver-1' || filter.status !== status) return null;
    status = update.$set.status;
    return { ...fakeJob, status, ...update.$set };
  }};
  const Profile = { updateOne: async () => { freed++; }};
  const own = req => req.userId;
  const error = (s, msg) => { throw Object.assign(new Error(msg), { status: s }); };
  const audit = async (_req, evt) => { aud.push(evt); };
  const emit = (_app, to, evt, payload) => { emissions.push({to,evt,payload}); };
  const fn = new Function('assignedJob','Job','Profile','own','error','audit','emit',`return (${code.replace('async function tripTransition','async function')})`)(assignedJob,Job,Profile,own,error,audit,emit);
  const req = {userId:'driver-1',app:{}};
  let response;
  const res = {json: obj => {response = obj; return obj;}};
  return {fn,req,res,get status(){return status;}, get freed(){return freed;},get emissions(){return emissions;},get response(){return response;}};
}

test('inicio e conclusao sem PIN, preservando etapas e estado financeiro',async()=>{
 const x=setup('no_local');
 await x.fn(x.req,x.res,'iniciar');
 assert.equal(x.status,'em_andamento');
 assert.equal(x.freed,0);
 await x.fn(x.req,x.res,'concluir');
 assert.equal(x.status,'concluida');
 assert.equal(x.freed,1);
 assert.deepEqual(x.emissions.map(e=>e.payload.status),['em_andamento','concluida']);
 assert.equal(x.response.ok,true);
});

test('motorista nao pode concluir sem iniciar', async()=>{
 const x=setup('no_local');
 await assert.rejects(()=>x.fn(x.req,x.res,'concluir'),{status:409});
 assert.equal(x.status,'no_local');
});

test('somente o motorista designado pode iniciar', async()=>{
 const x=setup('no_local');
 await assert.rejects(()=>x.fn({...x.req,userId:'outro'},x.res,'iniciar'),{status:404});
 assert.equal(x.status,'no_local');
});

test('nao gera nem devolve PIN para novas solicitacoes',()=>{
 const start = source.indexOf('async function createRequest('), end=source.indexOf('async function listClientJobs(',start);
 const fragment=source.slice(start,end);
 assert(!fragment.includes('pin()'));
 assert(!fragment.includes('codigoInicioCriptografado:encrypt'));
 assert(!fragment.includes('codigos:{'));
 assert(!code.includes('comparePin'));
});
