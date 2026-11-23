'use strict';
// A busca convencional so deve exibir as atividades tradicionais.
// Motorista fica disponivel exclusivamente pelo despacho de Mobilidade.
function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
function atividadeMobilidade(nome) {
  const n = normalizar(nome);
  return /^(motorista(?:\s*\([^)]*\))?|motorista de aplicativo|uber|motouber|moto uber|mototaxi|mototaxista|moto uber|entregador por aplicativo)$/.test(n);
}
function nomes(prof) {
  const itens = [prof?.profissaoNome];
  for (const x of (Array.isArray(prof?.profissoes) ? prof.profissoes : [])) itens.push(typeof x === 'string' ? x : x?.nome);
  for (const x of (Array.isArray(prof?.profissoesDetalhadas) ? prof.profissoesDetalhadas : [])) itens.push(typeof x === 'string' ? x : x?.nome);
  return [...new Set(itens.map(x => String(x || '').trim()).filter(Boolean))];
}
function ehApenasMotorista(prof) {
  const itens = nomes(prof);
  return itens.length > 0 && itens.some(atividadeMobilidade) && itens.every(atividadeMobilidade);
}
function contemProfissaoComum(prof) {
  return nomes(prof).some(x => !atividadeMobilidade(x));
}
function somenteBuscaTradicional(prof) {
  if (!prof) return null;
  const originais = nomes(prof);
  if (!originais.some(atividadeMobilidade)) return prof;
  const tradicionais = originais.filter(x => !atividadeMobilidade(x));
  if (!tradicionais.length) return null;
  const detalhadas = (Array.isArray(prof.profissoesDetalhadas) ? prof.profissoesDetalhadas : []).filter(x => !atividadeMobilidade(typeof x === 'string' ? x : x?.nome));
  const principal = detalhadas.find(x => x && typeof x === 'object') || null;
  const vista = { ...prof, profissoes: tradicionais, profissoesDetalhadas: detalhadas, profissaoNome: principal?.nome || tradicionais[0] };
  if (principal?.profissaoId) vista.profissaoId = principal.profissaoId;
  else delete vista.profissaoId;
  if (principal?.categoriaId) vista.categoriaId = principal.categoriaId;
  else delete vista.categoriaId;
  return vista;
}
function termoBuscaMobilidade(query) {
  return /\b(motorista|uber|motouber|moto uber|mototaxi|mototaxista)\b/.test(normalizar(query));
}
module.exports = { normalizar, atividadeMobilidade, nomes, ehApenasMotorista, contemProfissaoComum, somenteBuscaTradicional, termoBuscaMobilidade };
