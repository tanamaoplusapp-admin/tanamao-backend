const mongoose = require('mongoose');
const Categoria = require('./models/Categoria');
const Profissao = require('./models/Profissao');

require('dotenv').config();

/* =========================================================
   DADOS DAS CATEGORIAS E PROFISSÕES
========================================================= */

const data = [

  /* =========================
     🚨 EMERGÊNCIA
  ========================= */

  {
    nome: 'Emergência',
    profissões: [
      'Chaveiro 24h',
      'Guincho',
      'Borracheiro',
      'Mecânico emergencial',
      'Diarista',
      'Babá',
    ],
  },

  /* =========================
     🔧 SERVIÇOS GERAIS
  ========================= */

  {
    nome: 'Serviços gerais',
    profissões: [
      'Eletricista',
      'Borracheiro',
      'Carpinteiro',
      'Encanador',
      'Frete',
      'Mestre de obras',
      'Mudanças residenciais',
      'Pedreiro',
      'Pintor',
      'Montador de móveis',
      'Marceneiro',
      'Mecânico',
      'Lavagem automotiva delivery',
      'Limpa-fossa',
      'Limpeza de quintal',
      'Loja online',
      'Gesseiro',
      'Vidraceiro',
      'Serralheiro',
      'Reparos simples',
      'Técnico de ar-condicionado',
      'Técnico em eletrodomésticos',
    ],
  },

  /* =========================
     🧍 SERVIÇOS PESSOAIS
  ========================= */

  {
    nome: 'Serviços pessoais',
    profissões: [
      'Diarista',
      'Faxineira',
      'Babá',
      'Cuidador de idosos',
      'Cozinheira',
      'Passadeira',
      'Caseiro',
    ],
  },

  /* =========================
     💄 BELEZA
  ========================= */

  {
    nome: 'Beleza',
    profissões: [
      'Cabeleireiro',
      'Barbeiro',
      'Manicure',
      'Pedicure',
      'Esteticista',
      'Designer de sobrancelhas',
      'Maquiador',
      'Lash designer',
      'Depiladora',
      'Micropigmentador',
    ],
  },

  /* =========================
     👷 PROFISSIONAIS ESPECIALIZADOS
  ========================= */

  {
    nome: 'Profissionais especializados',
    profissões: [
      'Arquiteto',
      'Engenheiro civil',
      'Engenheiro elétrico',
      'Engenheiro mecânico',
      'Engenheiro agrônomo',
      'Advogado',
      'Contador',
      'Projetista',
      'Despachante',
      'Dedetizador',
      'Corretor de imóveis',
      'Consultor',
    ],
  },

  /* =========================
     📚 EDUCAÇÃO
  ========================= */

  {
    nome: 'Educação',
    profissões: [
      'Professor particular',
      'Professor de idiomas',
      'Instrutor de informática',
      'Instrutor de direção',
      'Professor de música',
      'Professor',
    ],
  },

  /* =========================
     💻 DIGITAL
  ========================= */

  {
    nome: 'Digital',
    profissões: [
      'Designer gráfico',
      'Editor de vídeo',
      'Social media',
      'Gestor de tráfego',
      'Criador de sites ou apps',
      'Desenvolvedor',
      'Programador',
      'Web designer',
      'Copywriter',
    ],
  },

  /* =========================
     🩺 SAÚDE
  ========================= */

  {
    nome: 'Saúde',
    profissões: [
      'Psicólogo',
      'Fisioterapeuta',
      'Massoterapeuta',
      'Nutricionista',
      'Terapeuta holístico',
      'Podólogo',
      'Personal trainer',
    ],
  },
];

/* =========================================================
   SLUG
========================================================= */

const slugify = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');

/* =========================================================
   EXECUTAR SEED
========================================================= */

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        'MONGO_URI não definido no .env'
      );
    }

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log('🔥 Conectado no Mongo');

    console.log(
      '🔄 Sincronizando categorias e profissões...'
    );

    /* =====================================================
       PERCORRER CATEGORIAS
    ===================================================== */

    for (const cat of data) {
      const slugCategoria = slugify(cat.nome);

      /* ===================================================
         BUSCAR CATEGORIA EXISTENTE
      =================================================== */

      let categoria =
        await Categoria.findOne({
          $or: [
            {
              nome: cat.nome,
            },
            {
              slug: slugCategoria,
            },
          ],
        });

      /* ===================================================
         CRIAR SOMENTE SE NÃO EXISTIR
      =================================================== */

      if (!categoria) {
        categoria = await Categoria.create({
          nome: cat.nome,
          slug: slugCategoria,
        });

        console.log(
          `🆕 Categoria criada: ${cat.nome}`
        );
      } else {
        let alterouCategoria = false;

        if (categoria.nome !== cat.nome) {
          categoria.nome = cat.nome;
          alterouCategoria = true;
        }

        if (
          categoria.slug !== slugCategoria
        ) {
          categoria.slug = slugCategoria;
          alterouCategoria = true;
        }

        if (alterouCategoria) {
          await categoria.save();

          console.log(
            `🔄 Categoria atualizada: ${cat.nome}`
          );
        } else {
          console.log(
            `✅ Categoria existente: ${cat.nome}`
          );
        }
      }

      /* ===================================================
         PERCORRER PROFISSÕES DA CATEGORIA
      =================================================== */

      for (const nomeProf of cat.profissões) {

        /* =================================================
           BUSCAR PROFISSÃO EXISTENTE NA CATEGORIA
        ================================================= */

        let profissao =
          await Profissao.findOne({
            nome: nomeProf,
            categoriaId: categoria._id,
          });

        /* =================================================
           CRIAR SOMENTE SE NÃO EXISTIR
        ================================================= */

        if (!profissao) {
          profissao =
            await Profissao.create({
              nome: nomeProf,
              categoriaId: categoria._id,
            });

          console.log(
            `   🆕 ${nomeProf}`
          );
        } else {
          console.log(
            `   ✓ ${nomeProf}`
          );
        }
      }
    }

    console.log('');
    console.log(
      '🚀 Seed sincronizado com sucesso!'
    );

    console.log(
      '✅ Categorias existentes mantiveram seus IDs.'
    );

    console.log(
      '✅ Profissões existentes mantiveram seus IDs.'
    );

    console.log(
      '✅ Novas categorias e profissões foram adicionadas.'
    );

  } catch (err) {
    console.error(
      '❌ ERRO NO SEED:',
      err
    );

    process.exitCode = 1;

  } finally {
    await mongoose.disconnect();

    console.log(
      '🔌 MongoDB desconectado.'
    );
  }
}

run();