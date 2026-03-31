// backend/workers/importWorker.js
require('dotenv').config();
const { importQueue } = require('../Queues/importQueue');
const { runTinySync } = require('../services/integracoes/adapters/tinyAdapter');
const { runOmieSync } = require('../services/integracoes/adapters/omieAdapter');

console.log('👷 Worker import-queue iniciado');

importQueue.process('sync-from-provider', async (job) => {
  const { empresaId, provider } = job.data || {};
  console.log(`[worker] sync-from-provider: provider=${provider} empresaId=${empresaId}`);

  if (!empresaId || !provider) throw new Error('Dados inválidos para sync-from-provider');

  if (provider === 'tiny') {
    const res = await runTinySync({ empresaId });
    console.log('[worker] tiny sync result:', res);
    return res;
  }

  if (provider === 'omie') {
    const res = await runOmieSync({ empresaId });
    console.log('[worker] omie sync result:', res);
    return res;
  }

  throw new Error(`Provider não suportado: ${provider}`);
});

// (opcional) importação de CSV se você usa via fila
importQueue.process('import-csv', async (job) => {
  const { empresaId } = job.data || {};
  console.log(`[worker] import-csv: empresaId=${empresaId}`);
  // TODO: parse CSV e upsert aqui se necessário
  return { ok: true };
});
