// services/integracoes/orderSync.js
exports.syncOrders = async (companyId, { mode = 'push' } = {}) => {
  // TODO: integrar pedidos (local <-> provider) conforme teu modelo Order
  return { ok: true, mode, companyId };
};
