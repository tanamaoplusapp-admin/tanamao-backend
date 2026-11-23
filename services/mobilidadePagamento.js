'use strict';
// Repete exatamente as preferencias que ja existem em Profissional.js:
// aceitaPix, aceitaCartao e aceitaDinheiro.
// O pagamento do servico e feito DIRETAMENTE ao prestador.
// A API apenas registra a forma combinada e as declaracoes dos participantes.
const Profissional = require('../models/Profissional');
const FORMAS = Object.freeze(['pix', 'cartao', 'dinheiro']);
const CAMPOS = Object.freeze({pix: 'aceitaPix', cartao: 'aceitaCartao', dinheiro: 'aceitaDinheiro'});

function validarForma(forma) {
  const nome = String(forma || '').trim().toLowerCase();
  if (!FORMAS.includes(nome)) {
    const err = new Error('Selecione uma forma de pagamento: pix, cartao ou dinheiro');
    err.status = 400;
    throw err;
  }
  return nome;
}
function listarFormas(prof) {
  return FORMAS.filter(forma => prof?.[CAMPOS[forma]] === true);
}
function aceitaForma(prof, forma) {
  return !!prof && prof[CAMPOS[validarForma(forma)]] === true;
}
async function buscarPreferencias(profissionalId) {
  return Profissional.findById(profissionalId)
    .select('aceitaPix aceitaCartao aceitaDinheiro')
    .lean();
}
module.exports = {FORMAS, CAMPOS, validarForma, listarFormas, aceitaForma, buscarPreferencias};
