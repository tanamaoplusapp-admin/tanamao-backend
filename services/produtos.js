// services/produtos.js
const Product = require('../models/product');

const isUrlLike = (s) =>
  typeof s === 'string' &&
  (/^https?:\/\//i.test(s.trim()) || /^data:image\//i.test(s.trim()));

function toImages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === 'number' ? String(x) : x))
    .filter(isUrlLike);
}

async function upsertProducts(empresaId, items = []) {
  const ops = [];
  const errors = [];
  let upserted = 0;

  for (const raw of items) {
    try {
      const externalId = String(raw.externalId || '').trim() || undefined;
      const name = String(raw.nome || raw.name || '').trim();
      if (!name) throw new Error('nome obrigatório ausente');

      const price =
        raw.preco != null
          ? Number(raw.preco)
          : raw.precoPorUnidade != null
          ? Number(raw.precoPorUnidade)
          : 0;

      const stock =
        raw.estoque != null
          ? Number(raw.estoque)
          : raw.estoqueUnidade != null
          ? Number(raw.estoqueUnidade)
          : 0;

      const images = toImages(raw.imagens || raw.images || []);

      ops.push({
        updateOne: {
          filter: externalId ? { company: empresaId, externalId } : { company: empresaId, name },
          update: {
            $set: {
              company: empresaId,
              externalId,
              name,
              description: String(raw.descricao || raw.description || '').trim(),
              category: String(raw.categoria || raw.category || 'geral').trim(),
              brand: String(raw.brand || '').trim() || undefined,
              price: Number(price || 0),
              stock: Number(stock || 0),
              images,
              isActive: raw.ativo !== false,
              // Se quiser, guarde também atributos/características aqui
            },
          },
          upsert: true,
        },
      });
      upserted++;
    } catch (e) {
      errors.push({ externalId: raw?.externalId || null, error: String(e.message || e) });
    }
  }

  if (ops.length) await Product.bulkWrite(ops, { ordered: false });
  return { upserted, skipped: items.length - upserted, errors: errors.length, errorItems: errors };
}

async function updateInventory(empresaId, items = []) {
  const ops = [];
  for (const it of items) {
    const set = {};
    if (it.preco != null) set.price = Number(it.preco);
    if (it.precoPorUnidade != null) set.price = Number(it.precoPorUnidade);
    if (it.estoque != null) set.stock = Number(it.estoque);
    if (it.estoqueUnidade != null) set.stock = Number(it.estoqueUnidade);

    const externalId = String(it.externalId || '').trim() || undefined;
    const filter = externalId ? { company: empresaId, externalId } : { company: empresaId, name: String(it.nome || '').trim() };
    ops.push({ updateOne: { filter, update: { $set: set } } });
  }
  if (ops.length) await Product.bulkWrite(ops, { ordered: false });
  return { updated: ops.length };
}

module.exports = { upsertProducts, updateInventory };
