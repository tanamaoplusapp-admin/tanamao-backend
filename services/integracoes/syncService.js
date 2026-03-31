// services/integracoes/syncService.js
const productSvc = require('./productSync');
const companySvc = require('./companySync');

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Enfileira (simples) uma sincronização inicial ao conectar credencial.
 * Pode ser substituído por Bull/BullMQ sem mudar a assinatura.
 */
exports.enqueueSyncFromProvider = async ({ empresaId, companyId, provider }) => {
  const cid = companyId || empresaId; // compat
  if (!cid) return;

  // Backoff básico para não travar o request do callback OAuth
  await delay(200);

  // Estratégia inicial: sincronizar cadastro + produtos (pull)
  try {
    await companySvc.syncCompanyAllProviders(cid);
  } catch (e) {
    console.warn('[syncService] company sync erro:', e?.message || e);
  }
  try {
    await productSvc.syncProducts(cid, { mode: 'pull' });
  } catch (e) {
    console.warn('[syncService] product sync erro:', e?.message || e);
  }
};
