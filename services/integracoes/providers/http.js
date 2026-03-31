// services/integracoes/providers/tiny.js
// Docs Tiny API v2: endpoints *.php com format=json & token=...
const { requestJson, toFormUrlEncoded } = require('./http');

const BASE = 'https://api.tiny.com.br/api2';

// Helper para compor URL com token/format
function buildUrl(endpoint, token, qs = '') {
  const sep = qs ? (qs.startsWith('?') ? '' : '?') : '?';
  return `${BASE}/${endpoint}${sep}${qs ? `${qs}&` : ''}token=${encodeURIComponent(token)}&format=json`;
}

// -------- Produtos --------

// Pesquisa produtos (pagina 1..n). Retorna { produtos:[], pagina, paginas }
exports.searchProducts = async ({ token, page = 1, pesquisa = '' }) => {
  const qs = `page=${page}${pesquisa ? `&pesquisa=${encodeURIComponent(pesquisa)}` : ''}`;
  const url = buildUrl('produto.pesquisa.php', token, qs);
  return requestJson(url, { method: 'GET' });
};

// Consulta produto por código (SKU interno)
exports.getProductBySku = async ({ token, sku }) => {
  const url = buildUrl('produto.obter.php', token);
  const body = toFormUrlEncoded({ codigo: sku });
  return requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
};

// Incluir produto. payloadTiny deve seguir schema do Tiny (campo "produto")
exports.createProduct = async ({ token, payloadTiny }) => {
  const url = buildUrl('produto.incluir.php', token);
  const body = toFormUrlEncoded({ produto: payloadTiny });
  return requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
};

// Alterar produto (por código)
exports.updateProduct = async ({ token, payloadTiny }) => {
  const url = buildUrl('produto.alterar.php', token);
  const body = toFormUrlEncoded({ produto: payloadTiny });
  return requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
};

// -------- Preço --------
exports.updatePrice = async ({ token, sku, price }) => {
  // Alguns contratos do Tiny usam alterar produto com o preço no payload; este endpoint cobre cenários dedicados
  const url = buildUrl('produto.alterar.preco.php', token);
  const body = toFormUrlEncoded({ codigo: sku, preco: Number(price) });
  return requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
};

// -------- Estoque --------
exports.updateStock = async ({ token, sku, estoque }) => {
  const url = buildUrl('produto.alterar.estoque.php', token);
  const body = toFormUrlEncoded({ codigo: sku, estoque: Number(estoque) });
  return requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
};
