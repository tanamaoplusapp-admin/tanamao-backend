// services/integracoes/mappers/product.js
// Mapeador de produto p/ seu schema real (models/product.js)
// Campos do seu modelo: name, description, category, brand, price, stock, isActive, images, company, caracteristicas[], attributes(Map)
// Referência: :contentReference[oaicite:0]{index=0}

function getAttr(prod, key) {
  try {
    // Map de attributes (string->string)
    if (prod?.attributes?.get && prod.attributes.has(key)) return prod.attributes.get(key);
    // fallback em objeto literal (caso venha plain)
    if (prod?.attributes && typeof prod.attributes === 'object') return prod.attributes[key];
  } catch {}
  return undefined;
}

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normStr(v, def = '') {
  if (v === null || v === undefined) return def;
  return String(v);
}

/** SKU/código que enviaremos ao ERP.
 *  Preferência:
 *   1) attributes.sku
 *   2) attributes.codigo / code
 *   3) 'TM-' + _id  (estável e único)
 */
function deriveSku(prod) {
  return (
    getAttr(prod, 'sku') ||
    getAttr(prod, 'codigo') ||
    getAttr(prod, 'code') ||
    (prod?._id ? `TM-${prod._id}` : undefined)
  );
}

/** Unidade comercial padrão: attributes.unit | 'UN' */
function deriveUnit(prod) {
  return (getAttr(prod, 'unit') || getAttr(prod, 'unidade') || 'UN').toUpperCase();
}

/** NCM/EAN/GTIN/Dimensões opcionais vindos de attributes */
function deriveOptional(prod) {
  return {
    ncm: normStr(getAttr(prod, 'ncm') || ''),
    gtin: normStr(getAttr(prod, 'gtin') || getAttr(prod, 'ean') || ''),
    peso: toNum(getAttr(prod, 'weight') || getAttr(prod, 'peso') || 0),
    altura: toNum(getAttr(prod, 'height') || getAttr(prod, 'altura') || 0),
    largura: toNum(getAttr(prod, 'width') || getAttr(prod, 'largura') || 0),
    profundidade: toNum(getAttr(prod, 'length') || getAttr(prod, 'profundidade') || 0),
  };
}

/** Texto complementar: junta brand/category pra enriquecer */
function descComplementar(prod) {
  const parts = [];
  if (prod?.brand) parts.push(`Marca: ${prod.brand}`);
  if (prod?.category) parts.push(`Categoria: ${prod.category}`);
  return parts.join(' | ');
}

/* ========== Local -> Tiny ========== */
exports.localToTiny = (prod) => {
  const sku = deriveSku(prod);
  const unit = deriveUnit(prod);
  const opt = deriveOptional(prod);
  return JSON.stringify({
    codigo: sku,
    descricao: normStr(prod?.name),
    unidade: unit,
    situacao: prod?.isActive === false ? 'I' : 'A',
    preco: toNum(prod?.price, 0),
    ncm: opt.ncm,
    gtin: opt.gtin,
    peso_bruto: opt.peso,
    altura: opt.altura,
    largura: opt.largura,
    profundidade: opt.profundidade,
    descricao_complementar: (prod?.description ? normStr(prod.description) + ' ' : '') + descComplementar(prod),
  });
};

/* ========== Local -> Omie ========== */
exports.localToOmie = (prod) => {
  const sku = deriveSku(prod);
  const unit = deriveUnit(prod);
  const opt = deriveOptional(prod);
  return {
    codigo_produto: String(sku),
    descricao: normStr(prod?.name),
    unidade: unit,
    valor_unitario: toNum(prod?.price, 0),
    ncm: opt.ncm,
    codigo_barras: opt.gtin,
    peso_bruto: opt.peso,
    altura: opt.altura,
    largura: opt.largura,
    profundidade: opt.profundidade,
    inativo: prod?.isActive === false,
    observacao: (prod?.description ? normStr(prod.description) + ' ' : '') + descComplementar(prod),
  };
};

/* ========== Tiny -> Local (payload pesquisa/obter) ========== */
exports.tinyToLocal = (tinyProd) => {
  const p = tinyProd?.produto || tinyProd || {};
  return {
    // mapeamos para os campos do seu modelo
    name: p.descricao || p.nome || '',
    description: p.descricao_complementar || '',
    brand: p.marca || '',
    category: p.categoria || '',
    price: toNum(p.preco, 0),
    stock: toNum(p.estoque, 0),
    isActive: (p.situacao || 'A') === 'A',

    // colocamos metadados importantes em attributes
    attributes: {
      sku: p.codigo || p.referencia || '',
      unit: p.unidade || 'UN',
      ncm: p.ncm || '',
      gtin: p.gtin || p.ean || '',
      weight: toNum(p.peso_bruto, 0),
      height: toNum(p.altura, 0),
      width: toNum(p.largura, 0),
      length: toNum(p.profundidade, 0),
    },
  };
};

/* ========== Omie -> Local (Listar/Consultar) ========== */
exports.omieToLocal = (o) => {
  const p = o?.produto_cadastro || o || {};
  return {
    name: p.descricao || '',
    description: p.observacao || '',
    brand: p.marca || '',
    category: p.categoria || '',
    price: toNum(p.valor_unitario, 0),
    // Omie nem sempre traz estoque aqui; se vier, usamos:
    stock: toNum(p.estoque, 0),
    isActive: !p.inativo,

    attributes: {
      sku: p.codigo_produto || '',
      unit: p.unidade || 'UN',
      ncm: p.ncm || '',
      gtin: p.codigo_barras || '',
      weight: toNum(p.peso_bruto, 0),
      height: toNum(p.altura, 0),
      width: toNum(p.largura, 0),
      length: toNum(p.profundidade, 0),
    },
  };
};

/** SKU derivado exportado p/ uso no sync */
exports.deriveSku = deriveSku;
