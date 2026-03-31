// backend/services/integracoes/upsertProducts.js
const Produto = require('../../models/product'); // ajuste esse caminho se seu model tiver outro nome

/**
 * Upsert em lote de produtos normalizados
 * items: [{ externalId, nome, descricao, precoPorUnidade, estoqueUnidade, unidade, source, lockedFields, meta }]
 */
exports.upsertProducts = async ({ empresaId, items }) => {
  if (!empresaId) throw new Error('empresaId obrigatório');
  const ops = (items || []).map((it) => ({
    updateOne: {
      filter: { empresaId, externalId: it.externalId },
      update: {
        $set: {
          empresaId,
          externalId: it.externalId,
          nome: it.nome,
          descricao: it.descricao,
          precoPorUnidade: it.precoPorUnidade,
          estoqueUnidade: it.estoqueUnidade,
          unidade: it.unidade || 'un',
          source: it.source || 'erp',
          lockedFields: it.lockedFields || ['precoPorUnidade', 'estoqueUnidade'],
          meta: it.meta || undefined,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      upsert: true,
    },
  }));

  if (ops.length) {
    await Produto.bulkWrite(ops, { ordered: false });
  }
};
