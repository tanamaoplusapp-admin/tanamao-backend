'use strict';
// O modulo so pode ser habilitado por prestadores que escolheram Motorista.
// Lida com os formatos de profissao legado e atual, sem alterar os schemas existentes.
function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function possuiProfissaoMotorista(prof) {
  const names=[prof?.profissaoNome,...(Array.isArray(prof?.profissoes)?prof.profissoes:[])];
  for(const x of (Array.isArray(prof?.profissoesDetalhadas)?prof.profissoesDetalhadas:[]))names.push(x?.nome);
  return names.some(name=>/\b(motorista|motouber|moto uber|uber|mototaxista|mototaxi)\b/.test(normalize(name)));
}
module.exports={possuiProfissaoMotorista};
