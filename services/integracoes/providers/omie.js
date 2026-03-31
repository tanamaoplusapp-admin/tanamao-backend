// services/integracoes/providers/omie.js
// Omie trabalha com "call" + app_key/app_secret. Aqui cobrimos list/consultar/incluir/alterar produto.
const { requestJson } = require('./http');

const PROD_URL = 'https://app.omie.com.br/api/v1/geral/produtos/';

async function omieCall({ call, appKey, appSecret, param }) {
  const body = { call, app_key: appKey, app_secret: appSecret, param: Array.isArray(param) ? param : [param] };
  return requestJson(PROD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

// ListarProdutos: paginação
exports.listProducts = async ({ appKey, appSecret, page = 1, perPage = 50 }) => {
  return omieCall({ call: 'ListarProdutos', appKey, appSecret, param: { pagina: page, registros_por_pagina: perPage } });
};

// Consultar por código (sku)
exports.getProductByCodigo = async ({ appKey, appSecret, codigo }) => {
  // Alguns ambientes usam "ConsultarProduto" com codigo_produto
  try {
    return await omieCall({ call: 'ConsultarProduto', appKey, appSecret, param: { codigo_produto: codigo } });
  } catch (e) {
    // fallback por pesquisa
    const page1 = await exports.listProducts({ appKey, appSecret, page: 1, perPage: 50 });
    const hit = (page1?.produto_cadastro || []).find(p => String(p?.codigo_produto) === String(codigo));
    return hit || null;
  }
};

exports.createProduct = async ({ appKey, appSecret, payloadOmie }) => {
  return omieCall({ call: 'IncluirProduto', appKey, appSecret, param: payloadOmie });
};

exports.updateProduct = async ({ appKey, appSecret, payloadOmie }) => {
  return omieCall({ call: 'AlterarProduto', appKey, appSecret, param: payloadOmie });
};
