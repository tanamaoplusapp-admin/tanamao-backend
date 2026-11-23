'use strict';
// Execute uma unica vez (pode repetir sem duplicar):
//   cd backend
//   node scripts/criarProfissaoMobilidade.js
// Usa o mesmo banco configurado no .env; nao imprime credenciais.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Categoria = require('../models/Categoria');
const Profissao = require('../models/Profissao');

async function iniciar() {
  await connectDB();
  // Os cadastros consultam Categoria e Profissao, e nao CategoriaPrestador.
  let categoria = await Categoria.findOne({ slug: 'transporte-mobilidade' });
  if (!categoria) {
    categoria = await Categoria.create({
      nome: 'Transporte e Mobilidade',
      slug: 'transporte-mobilidade',
      icone: 'car-outline',
      ativa: true,
    });
  } else if (!categoria.ativa) {
    categoria.ativa = true;
    await categoria.save();
  }
  let profissao = await Profissao.findOne({ nome: /^motorista$/i });
  if (!profissao) {
    profissao = await Profissao.create({ nome: 'Motorista', categoriaId: categoria._id, ativa: true });
  } else if (!profissao.ativa || String(profissao.categoriaId) !== String(categoria._id)) {
    profissao.ativa = true;
    profissao.categoriaId = categoria._id;
    await profissao.save();
  }
  const conferida = await Profissao.findOne({ _id: profissao._id, categoriaId: categoria._id, ativa: true });
  if (!conferida) throw new Error('Nao foi possivel ativar a profissao Motorista no catalogo');
  console.log('OK - Categoria:', categoria.nome, String(categoria._id));
  console.log('OK - Profissao:', conferida.nome, String(conferida._id));
  console.log('Abra novamente o cadastro no aplicativo para atualizar a lista.');
}
iniciar().catch(e => {
  console.error('Erro ao criar Motorista:', e.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect().catch(() => {}));
