require('dotenv').config();

const mongoose = require('mongoose');

const User = require('../models/user');
const Profissional = require('../models/Profissional');

function slugCidade(cidade = '') {
  return String(cidade)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function migrar() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('✅ Mongo conectado\n');

    /* ===========================
       USERS
    =========================== */

    const usuarios = await User.find();

    let usersAtualizados = 0;

    for (const user of usuarios) {

      if (!user.cidade) continue;

      const slug = slugCidade(user.cidade);

      if (user.cidadeSlug === slug) continue;

      user.cidadeSlug = slug;

      await user.save();

      usersAtualizados++;

      console.log(`✔ User atualizado: ${user.name}`);
    }

    /* ===========================
       PROFISSIONAIS
    =========================== */

    const profissionais = await Profissional.find();

    let profissionaisAtualizados = 0;

    for (const prof of profissionais) {

      if (!prof.endereco?.cidade) continue;

      const slug = slugCidade(prof.endereco.cidade);

      prof.endereco = {
        ...prof.endereco,
        cidadeSlug: slug,
      };

      await prof.save();

      profissionaisAtualizados++;

      console.log(`✔ Profissional atualizado: ${prof.name}`);
    }

    console.log('\n===============================');
    console.log(`Users atualizados: ${usersAtualizados}`);
    console.log(`Profissionais atualizados: ${profissionaisAtualizados}`);
    console.log('Migração concluída.');
    console.log('===============================\n');

    process.exit();

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrar();