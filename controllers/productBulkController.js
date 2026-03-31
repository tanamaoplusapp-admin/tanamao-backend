// controllers/productBulkController.js
import { upsertProducts, updateInventory } from '../services/produtos.js';
import IdempotencyKey from '../models/IdempotencyKey.js';

export async function bulkUpsert(req, res) {
  const { empresaId, items } = req.body;
  const result = await upsertProducts(empresaId, items || []);
  // salva resposta da idempotência se vier header
  if (req.idem) {
    await IdempotencyKey.create({ empresaId, key: req.idem.key, lastResponse: { ok: true, ...result } });
  }
  res.json({ ok: true, ...result });
}

export async function bulkInventory(req, res) {
  const { empresaId, items } = req.body;
  const result = await updateInventory(empresaId, items || []);
  if (req.idem) {
    await IdempotencyKey.create({ empresaId, key: req.idem.key, lastResponse: { ok: true, ...result } });
  }
  res.json({ ok: true, ...result });
}
