// services/integracoes/productSync.js
const IntegrationAccount = require('../../models/IntegrationAccount');
const IntegrationMap = require('../../models/IntegrationMap');
const Product = require('../../models/product'); // seu modelo real
const tiny = require('./providers/tiny');
const omie = require('./providers/omie');
const map = require('./mappers/product');

// helpers
async function ensureMap({ companyId, provider, localId, providerId, extra }) {
  let doc = await IntegrationMap.findOne({ companyId, provider, domain: 'product', localId });
  if (!doc) {
    doc = await IntegrationMap.create({ companyId, provider, domain: 'product', localId, providerId, extra });
  } else {
    const set = { ...(extra ? { extra } : {}) };
    if (providerId && providerId !== doc.providerId) set.providerId = providerId;
    if (Object.keys(set).length) await IntegrationMap.updateOne({ _id: doc._id }, { $set: set });
  }
  return doc;
}

function pickProviders(accounts) {
  return accounts.filter(a => a.enabled).map(a => ({ name: a.provider, acc: a }));
}

async function upsertLocal(companyId, localLike) {
  // chave natural local: (company, attributes.sku?) -> se não houver sku, criaremos produto novo com _id
  const sku = localLike?.attributes?.sku;
  let existing = null;
  if (sku) {
    existing = await Product.findOne({ company: companyId, 'attributes.sku': sku });
  }
  if (existing) {
    Object.assign(existing, localLike);
    await existing.save();
    return existing.toObject();
  }
  const created = await Product.create({ ...localLike, company: companyId });
  return created.toObject();
}

// --------------- PULL (ERP -> Local) ---------------

async function pullFromTiny(companyId, acc) {
  const token = acc.credentials.apiToken;
  let page = 1;
  let imported = 0;

  while (true) {
    const res = await tiny.searchProducts({ token, page });
    const list = res?.retorno?.produtos || res?.produtos || [];
    if (!Array.isArray(list) || list.length === 0) break;

    for (const item of list) {
      const localLike = map.tinyToLocal(item);
      const saved = await upsertLocal(companyId, localLike);
      const providerId = localLike?.attributes?.sku || '';
      await ensureMap({
        companyId,
        provider: 'tiny',
        localId: String(saved._id),
        providerId,
        extra: { lastPullAt: new Date().toISOString() },
      });
      imported++;
    }

    const pagina = Number(res?.retorno?.pagina || res?.pagina || page);
    const paginas = Number(res?.retorno?.paginas || res?.paginas || page);
    if (!paginas || pagina >= paginas) break;
    page++;
  }

  return { provider: 'tiny', imported };
}

async function pullFromOmie(companyId, acc) {
  const { appKey, appSecret } = acc.credentials;
  let page = 1;
  let imported = 0;

  while (true) {
    const res = await omie.listProducts({ appKey, appSecret, page, perPage: 50 });
    const list = res?.produto_cadastro || res?.lista || [];
    if (!Array.isArray(list) || list.length === 0) break;

    for (const item of list) {
      const localLike = map.omieToLocal(item);
      const saved = await upsertLocal(companyId, localLike);
      const providerId = localLike?.attributes?.sku || '';
      await ensureMap({
        companyId,
        provider: 'omie',
        localId: String(saved._id),
        providerId,
        extra: { lastPullAt: new Date().toISOString() },
      });
      imported++;
    }

    const pagina = Number(res?.pagina || page);
    const paginas = Number(res?.paginas || 1);
    if (!paginas || pagina >= paginas) break;
    page++;
  }

  return { provider: 'omie', imported };
}

// --------------- PUSH (Local -> ERP) ---------------

async function pushOneTiny(acc, prod) {
  const token = acc.credentials.apiToken;
  const sku = map.deriveSku(prod);
  const payloadTiny = map.localToTiny(prod);

  // consulta e decide update/incluir
  try {
    const exists = await tiny.getProductBySku({ token, sku });
    if (exists?.retorno?.status === 'OK' || exists?.produto) {
      return tiny.updateProduct({ token, payloadTiny });
    }
  } catch {}
  return tiny.createProduct({ token, payloadTiny });
}

async function pushOneOmie(acc, prod) {
  const { appKey, appSecret } = acc.credentials;
  const sku = map.deriveSku(prod);
  const payloadOmie = map.localToOmie(prod);

  try {
    const found = await omie.getProductByCodigo({ appKey, appSecret, codigo: sku });
    if (found && (found.codigo_produto || found?.produto_cadastro?.codigo_produto)) {
      return omie.updateProduct({ appKey, appSecret, payloadOmie });
    }
  } catch {}
  return omie.createProduct({ appKey, appSecret, payloadOmie });
}

async function pushAllToProvider(companyId, providerName, acc) {
  const rows = await Product.find({ company: companyId, isActive: { $in: [true, undefined] } }).lean();
  let ok = 0;

  for (const prod of rows) {
    try {
      const resp = providerName === 'tiny'
        ? await pushOneTiny(acc, prod)
        : await pushOneOmie(acc, prod);

      const providerId = map.deriveSku(prod);
      await ensureMap({
        companyId,
        provider: providerName,
        localId: String(prod._id),
        providerId,
        extra: { lastPushAt: new Date().toISOString(), lastResp: resp?.retorno || resp },
      });
      ok++;
    } catch (e) {
      console.warn(`[productSync] push ${providerName} sku=${map.deriveSku(prod)} erro:`, e?.message || e);
    }
  }
  return { provider: providerName, pushed: ok };
}

// --------------- API ---------------

exports.syncProducts = async (companyId, { mode = 'push' } = {}) => {
  const accounts = await IntegrationAccount.find({ companyId, 'scopes.products': true, enabled: true }).lean();
  const providers = pickProviders(accounts);
  const results = [];

  for (const p of providers) {
    if (mode === 'pull' || mode === 'both') {
      results.push(p.name === 'tiny'
        ? await pullFromTiny(companyId, p.acc)
        : await pullFromOmie(companyId, p.acc));
    }
    if (mode === 'push' || mode === 'both') {
      results.push(await pushAllToProvider(companyId, p.name, p.acc));
    }
  }
  return { ok: true, mode, results };
};

exports.syncInventory = async (companyId) => {
  const accounts = await IntegrationAccount.find({ companyId, 'scopes.inventory': true, enabled: true }).lean();
  const providers = pickProviders(accounts);
  const results = [];

  const rows = await Product.find({ company: companyId }).select({ _id: 1, attributes: 1, stock: 1 }).lean();
  for (const p of providers) {
    let ok = 0;
    for (const r of rows) {
      const sku = map.deriveSku(r);
      if (!sku) continue;
      try {
        if (p.name === 'tiny') {
          await tiny.updateStock({ token: p.acc.credentials.apiToken, sku, estoque: Number(r.stock || 0) });
          ok++;
        } else if (p.name === 'omie') {
          // Omie estoque costuma exigir módulo dedicado — manter como no-op até mapear endpoint específico
          // Exemplo (quando disponível): await omie.updateStock({ appKey, appSecret, codigo: sku, estoque: Number(r.stock||0) });
          ok++;
        }
      } catch (e) {
        console.warn(`[inventorySync] ${p.name} sku=${sku} erro:`, e?.message || e);
      }
    }
    results.push({ provider: p.name, updated: ok });
  }
  return { ok: true, results };
};

exports.syncPrices = async (companyId) => {
  const accounts = await IntegrationAccount.find({ companyId, 'scopes.prices': true, enabled: true }).lean();
  const providers = pickProviders(accounts);
  const results = [];

  const rows = await Product.find({ company: companyId }).select({ _id: 1, attributes: 1, price: 1 }).lean();
  for (const p of providers) {
    let ok = 0;
    for (const r of rows) {
      const sku = map.deriveSku(r);
      if (!sku) continue;
      try {
        if (p.name === 'tiny') {
          await tiny.updatePrice({ token: p.acc.credentials.apiToken, sku, price: Number(r.price || 0) });
          ok++;
        } else if (p.name === 'omie') {
          await omie.updateProduct({
            appKey: p.acc.credentials.appKey,
            appSecret: p.acc.credentials.appSecret,
            payloadOmie: { codigo_produto: sku, valor_unitario: Number(r.price || 0) },
          });
          ok++;
        }
      } catch (e) {
        console.warn(`[priceSync] ${p.name} sku=${sku} erro:`, e?.message || e);
      }
    }
    results.push({ provider: p.name, updated: ok });
  }
  return { ok: true, results };
};
