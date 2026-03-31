// =============================
// utils/unitCatalog.js (CommonJS)
// =============================
const UNIT_CATALOG = [
  { key: 'un', label: 'Unidade', kind: 'count', base: 'un', factorToBase: 1 },
  { key: 'cx', label: 'Caixa', kind: 'count', base: 'un', factorToBase: 1 },
  { key: 'pc', label: 'Pacote', kind: 'count', base: 'un', factorToBase: 1 },
  { key: 'fd', label: 'Fardo', kind: 'count', base: 'un', factorToBase: 1 },
  { key: 'rl', label: 'Rolo', kind: 'count', base: 'un', factorToBase: 1 },

  { key: 'g', label: 'Grama', kind: 'mass', base: 'kg', factorToBase: 0.001 },
  { key: 'kg', label: 'Quilo', kind: 'mass', base: 'kg', factorToBase: 1 },
  { key: 'ton', label: 'Tonelada', kind: 'mass', base: 'kg', factorToBase: 1000 },
  { key: 'saca60', label: 'Saca 60kg', kind: 'mass', base: 'kg', factorToBase: 60 },

  { key: 'ml', label: 'mL', kind: 'vol', base: 'L', factorToBase: 0.001 },
  { key: 'L', label: 'Litro', kind: 'vol', base: 'L', factorToBase: 1 },
  { key: 'm3', label: 'm³', kind: 'vol', base: 'L', factorToBase: 1000 },

  { key: 'm', label: 'Metro', kind: 'len', base: 'm', factorToBase: 1 },

  { key: 'm2', label: 'm²', kind: 'area', base: 'm2', factorToBase: 1 },
  { key: 'ha', label: 'Hectare', kind: 'area', base: 'm2', factorToBase: 10000 },
];

function getUnit(unitKey) {
  return UNIT_CATALOG.find((u) => u.key === unitKey);
}

function pricePerBase(precoPorUnidade, unitKey) {
  const u = getUnit(unitKey);
  if (!u) throw new Error('Unidade inválida');
  return Number(precoPorUnidade) / u.factorToBase;
}

module.exports = {
  UNIT_CATALOG,
  getUnit,
  pricePerBase,
};
