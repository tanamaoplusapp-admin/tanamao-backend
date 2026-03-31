// cron/importarProdutosCsv.js
import fs from 'fs';
import csv from 'csv-parser';
import { upsertProducts } from '../services/produtos.js';

export async function importarProdutosCsv(empresaId, filePath) {
  const items = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const atributos = row.atributos_json ? JSON.parse(row.atributos_json) : undefined;
        items.push({
          externalId: row.externalId,
          nome: row.nome,
          categoria: row.categoria || 'geral',
          subcategoria: row.subcategoria,
          unidade: row.unidade || 'un',
          precoPorUnidade: Number(row.precoPorUnidade || 0),
          estoqueUnidade: Number(row.estoqueUnidade || 0),
          ean: row.ean || undefined,
          ncm: row.ncm || undefined,
          atributos,
          ativo: row.ativo !== 'false'
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return upsertProducts(empresaId, items);
}
