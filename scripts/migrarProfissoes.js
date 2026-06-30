require('dotenv').config();

const mongoose = require('mongoose');

const Profissional = require('../models/Profissional');
const Profissao = require('../models/Profissao');

async function migrar() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('✅ Mongo conectado\n');

    const profissionais = await Profissional.find();

    console.log(`Profissionais encontrados: ${profissionais.length}\n`);

    let atualizados = 0;

    for (const prof of profissionais) {

      let alterou = false;

      const novasProfissoes = [];

      if (Array.isArray(prof.profissoesDetalhadas)) {

        for (const item of prof.profissoesDetalhadas) {

          const profissaoBanco = await Profissao.findOne({
            nome: item.nome,
            ativa: true,
          });

          if (!profissaoBanco) {
            console.log(`⚠ Profissão não encontrada: ${item.nome}`);
            novasProfissoes.push(item);
            continue;
          }

          novasProfissoes.push({
            profissaoId: profissaoBanco._id,
            categoriaId: profissaoBanco.categoriaId,
            categoriaNome: item.categoriaNome,
            nome: profissaoBanco.nome,
          });

          alterou = true;
        }

        prof.profissoesDetalhadas = novasProfissoes;
      }

      if (novasProfissoes.length > 0) {

        const principal = novasProfissoes[0];

        prof.profissaoId = principal.profissaoId;
        prof.categoriaId = principal.categoriaId;
        prof.profissaoNome = principal.nome;

        prof.profissoes = novasProfissoes.map(p => p.nome);

        alterou = true;
      }

      if (alterou) {
        await prof.save();

        atualizados++;

        console.log(`✔ ${prof.name} atualizado`);
      }
    }

    console.log('\n===================================');
    console.log(`Migração concluída.`);
    console.log(`${atualizados} profissionais atualizados.`);
    console.log('===================================\n');

    process.exit();

  } catch (err) {

    console.error(err);

    process.exit(1);
  }
}

migrar();