'use strict';

/** Resumo da reputacao registrada no Tanamao+, sem notas artificiais. */
async function obterReputacaoMotorista({ avaliacoes, motoristaId, profissionalId }) {
  if (!avaliacoes || !motoristaId) return { media: null, quantidade: 0 };
  const condicoes = [
    { motorista: motoristaId },
    { profissionalUserId: motoristaId },
    { profissional: motoristaId },
  ];
  if (profissionalId) condicoes.push({ profissionalId });
  const [resumo] = await avaliacoes.aggregate([
    { $match: { $or: condicoes, nota: { $gte: 1, $lte: 5 } } },
    { $group: { _id: null, quantidade: { $sum: 1 }, media: { $avg: '$nota' } } },
  ]);
  const quantidade = Number(resumo?.quantidade) || 0;
  const media = resumo?.media == null ? NaN : Number(resumo.media);
  if (quantidade <= 0 || !Number.isFinite(media) || media < 1 || media > 5) return { media: null, quantidade: 0 };
  return { media: Math.round(media * 10) / 10, quantidade };
}

module.exports = { obterReputacaoMotorista };
