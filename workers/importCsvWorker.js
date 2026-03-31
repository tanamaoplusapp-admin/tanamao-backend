const { Worker } = require('bullmq');
const { connection } = require('../Queues/importQueue');
const { runTinySync } = require('../services/integracoes/adapters/tinyAdapter');
const { runOmieSync } = require('../services/integracoes/adapters/omieAdapter');

/**
 * Worker único para consumir a fila "import-queue".
 * Jobs esperados:
 *  - "sync-from-provider": { empresaId, provider: 'tiny'|'omie'|'bling' }
 *  - "import-csv": seu fluxo atual de CSV
 */
new Worker('import-queue', async (job) => {
  const { name, data } = job;

  if (name === 'sync-from-provider') {
    const { empresaId, provider } = data || {};
    if (!empresaId || !provider) throw new Error('Dados inválidos para sync-from-provider');

    if (provider === 'tiny') {
      const res = await runTinySync({ empresaId });
      console.log('[worker] tiny sync:', res);
      return res;
    }
    if (provider === 'omie') {
      const res = await runOmieSync({ empresaId });
      console.log('[worker] omie sync:', res);
      return res;
    }
    // TODO: se precisar, adicione 'bling' aqui
    throw new Error(`Provider não suportado: ${provider}`);
  }

  if (name === 'import-csv') {
    // Mantenha aqui seu fluxo atual de importação CSV
    // ...
    return { ok: true };
  }

  console.warn('[worker] Job desconhecido:', name);
  return { ok: false, reason: 'job desconhecido' };
}, { connection });
