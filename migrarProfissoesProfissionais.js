const mongoose = require('mongoose');
require('dotenv').config();

const Profissional = require('./models/Profissional');
const Profissao = require('./models/Profissao');
const Categoria = require('./models/Categoria');

/* =========================================================
   NORMALIZAR TEXTO
========================================================= */

const normalizar = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/* =========================================================
   EXECUTAR MIGRAÇÃO
========================================================= */

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI não definido no .env');
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log('🔥 Conectado no Mongo');
    console.log('');
    console.log('🔄 Iniciando migração das profissões...');
    console.log('');

    /* =====================================================
       CARREGAR CATÁLOGO ATUAL
    ===================================================== */

    const profissoesAtuais = await Profissao.find({})
      .populate('categoriaId', 'nome')
      .lean();

    console.log(
      `📚 ${profissoesAtuais.length} profissões encontradas no catálogo atual.`
    );

    /* =====================================================
       CRIAR MAPA PELO NOME
    ===================================================== */

    const mapaProfissoes = new Map();

    for (const profissao of profissoesAtuais) {
      const nomeNormalizado = normalizar(profissao.nome);

      if (!nomeNormalizado) continue;

      if (!mapaProfissoes.has(nomeNormalizado)) {
        mapaProfissoes.set(nomeNormalizado, []);
      }

      mapaProfissoes.get(nomeNormalizado).push(profissao);
    }

    /* =====================================================
       BUSCAR PROFISSIONAIS
    ===================================================== */

    const profissionais = await Profissional.find({});

    console.log(
      `👷 ${profissionais.length} profissionais encontrados.`
    );

    console.log('');

    let profissionaisAtualizados = 0;
    let profissoesCorrigidas = 0;
    let profissionaisSemAlteracao = 0;
    let profissoesNaoEncontradas = 0;
    let profissoesAmbiguas = 0;

    /* =====================================================
       PERCORRER PROFISSIONAIS
    ===================================================== */

    for (const profissional of profissionais) {
      console.log('==========================================');

      console.log(
        `👤 Profissional: ${
          profissional.name ||
          profissional.nome ||
          profissional._id
        }`
      );

      const detalhesAtuais = Array.isArray(
        profissional.profissoesDetalhadas
      )
        ? profissional.profissoesDetalhadas
        : [];

      if (!detalhesAtuais.length) {
        console.log(
          '⚠️ Sem profissoesDetalhadas. Ignorando.'
        );

        profissionaisSemAlteracao++;
        continue;
      }

      let profissionalAlterado = false;

      /* ===================================================
         PERCORRER PROFISSÕES DO PROFISSIONAL
      =================================================== */

      for (const detalhe of detalhesAtuais) {
        const nomeSalvo =
          detalhe.nome ||
          detalhe.profissaoNome ||
          '';

        if (!nomeSalvo) {
          console.log(
            '⚠️ Profissão sem nome. Não é seguro migrar automaticamente.'
          );

          profissoesNaoEncontradas++;
          continue;
        }

        const nomeNormalizado = normalizar(nomeSalvo);

        const candidatas =
          mapaProfissoes.get(nomeNormalizado) || [];

        /* =================================================
           PROFISSÃO NÃO ENCONTRADA
        ================================================= */

        if (!candidatas.length) {
          console.log(
            `❌ Não encontrada no catálogo atual: ${nomeSalvo}`
          );

          profissoesNaoEncontradas++;
          continue;
        }

        /* =================================================
           ESCOLHER PROFISSÃO CORRETA
        ================================================= */

        let profissaoAtual = null;

        if (candidatas.length === 1) {
          profissaoAtual = candidatas[0];
        } else {
          /*
           Existem profissões repetidas em categorias
           diferentes, como Diarista, Babá e Borracheiro.

           Primeiro tentamos identificar pela categoria
           atualmente salva no detalhe.
          */

          const categoriaAtualId =
            detalhe.categoriaId
              ? String(detalhe.categoriaId)
              : null;

          profissaoAtual = candidatas.find(
            (item) =>
              String(item.categoriaId?._id || item.categoriaId) ===
              categoriaAtualId
          );

          /*
           Se o categoriaId antigo não existir mais,
           tentamos pelo nome da categoria salva.
          */

          if (!profissaoAtual) {
            const nomeCategoriaSalva = normalizar(
              detalhe.categoriaNome ||
              detalhe.nomeCategoria ||
              ''
            );

            if (nomeCategoriaSalva) {
              profissaoAtual = candidatas.find(
                (item) =>
                  normalizar(item.categoriaId?.nome) ===
                  nomeCategoriaSalva
              );
            }
          }

          /*
           Se ainda não foi possível identificar,
           não alteramos automaticamente.
          */

          if (!profissaoAtual) {
            console.log(
              `⚠️ Profissão ambígua: ${nomeSalvo}`
            );

            console.log(
              `   Existem ${candidatas.length} profissões com esse nome em categorias diferentes.`
            );

            console.log(
              '   Não foi alterada automaticamente.'
            );

            profissoesAmbiguas++;
            continue;
          }
        }

        const novoProfissaoId =
          profissaoAtual._id;

        const novoCategoriaId =
          profissaoAtual.categoriaId?._id ||
          profissaoAtual.categoriaId;

        const profissaoIdAntigo =
          detalhe.profissaoId
            ? String(detalhe.profissaoId)
            : '';

        const categoriaIdAntigo =
          detalhe.categoriaId
            ? String(detalhe.categoriaId)
            : '';

        const profissaoIdNovo =
          String(novoProfissaoId);

        const categoriaIdNovo =
          String(novoCategoriaId);

        /* =================================================
           VERIFICAR SE PRECISA CORRIGIR
        ================================================= */

        if (
          profissaoIdAntigo === profissaoIdNovo &&
          categoriaIdAntigo === categoriaIdNovo
        ) {
          console.log(
            `✓ Já correta: ${nomeSalvo}`
          );

          continue;
        }

        console.log(`🔧 Corrigindo: ${nomeSalvo}`);

        console.log(
          `   profissaoId: ${profissaoIdAntigo || 'vazio'}`
        );

        console.log(
          `             → ${profissaoIdNovo}`
        );

        console.log(
          `   categoriaId: ${categoriaIdAntigo || 'vazio'}`
        );

        console.log(
          `              → ${categoriaIdNovo}`
        );

        detalhe.profissaoId = novoProfissaoId;
        detalhe.categoriaId = novoCategoriaId;

        profissionalAlterado = true;
        profissoesCorrigidas++;
      }

      /* ===================================================
         CORRIGIR CAMPOS PRINCIPAIS DE COMPATIBILIDADE
      =================================================== */

      if (
        profissionalAlterado &&
        detalhesAtuais.length > 0
      ) {
        const primeiraProfissao =
          detalhesAtuais[0];

        if (primeiraProfissao?.profissaoId) {
          profissional.profissaoId =
            primeiraProfissao.profissaoId;
        }

        if (primeiraProfissao?.categoriaId) {
          profissional.categoriaId =
            primeiraProfissao.categoriaId;
        }

        if (primeiraProfissao?.nome) {
          profissional.profissaoNome =
            primeiraProfissao.nome;
        }

        /* =================================================
           SALVAR PROFISSIONAL
        ================================================= */

        await profissional.save();

        profissionaisAtualizados++;

        console.log(
          '💾 Profissional atualizado com sucesso.'
        );
      } else {
        profissionaisSemAlteracao++;

        console.log(
          '✓ Nenhuma alteração necessária.'
        );
      }
    }

    /* =====================================================
       RESULTADO
    ===================================================== */

    console.log('');
    console.log('==========================================');
    console.log('🚀 MIGRAÇÃO FINALIZADA');
    console.log('==========================================');

    console.log(
      `👷 Profissionais analisados: ${profissionais.length}`
    );

    console.log(
      `💾 Profissionais atualizados: ${profissionaisAtualizados}`
    );

    console.log(
      `🔧 Profissões corrigidas: ${profissoesCorrigidas}`
    );

    console.log(
      `✓ Sem alterações: ${profissionaisSemAlteracao}`
    );

    console.log(
      `❌ Profissões não encontradas: ${profissoesNaoEncontradas}`
    );

    console.log(
      `⚠️ Profissões ambíguas: ${profissoesAmbiguas}`
    );

    console.log('==========================================');

  } catch (err) {
    console.error('');
    console.error('❌ ERRO NA MIGRAÇÃO:');
    console.error(err);

    process.exitCode = 1;

  } finally {
    await mongoose.disconnect();

    console.log('');
    console.log('🔌 MongoDB desconectado.');
  }
}

run();