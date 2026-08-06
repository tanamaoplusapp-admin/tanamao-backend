const Counter = require('../models/Counter');

/**
 * Gera a próxima sequência de um contador.
 *
 * Exemplo:
 *
 * gerarSequencia('orcamento')
 *
 * retorno:
 * {
 *    ano: 2026,
 *    sequencia: 154
 * }
 */

async function gerarSequencia(nome) {
  const ano = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    {
      _id: nome,
      ano,
    },
    {
      $inc: {
        sequencia: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    ano,
    sequencia: counter.sequencia,
  };
}

/**
 * Formata um número.
 *
 * Ex:
 *
 * ORC-2026-000154
 */

function formatarNumero(prefixo, ano, sequencia) {
  return `${prefixo}-${ano}-${String(sequencia).padStart(6, '0')}`;
}

/**
 * Gera um número completo.
 *
 * Ex:
 *
 * gerarNumeroDocumento('ORC','orcamento')
 *
 * retorna:
 *
 * ORC-2026-000154
 */

async function gerarNumeroDocumento(prefixo, contador) {
  const { ano, sequencia } = await gerarSequencia(contador);

  return formatarNumero(prefixo, ano, sequencia);
}

module.exports = {
  gerarSequencia,
  formatarNumero,
  gerarNumeroDocumento,
};