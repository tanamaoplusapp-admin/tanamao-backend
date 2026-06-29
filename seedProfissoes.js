const mongoose = require('mongoose');
const Categoria = require('./models/Categoria');
const Profissao = require('./models/Profissao');

const MONGO_URI = 'SUA_URL_AQUI';

const data = [

  /* =========================
     🚨 EMERGÊNCIA (CRÍTICO)
  ========================= */
  {
    nome: 'Emergência',
    profissões: [
      'Chaveiro 24h',
      'Guincho',
      'Borracheiro',
      'Mecânico emergencial',
      'Socorrista automotivo',
      'Diarista',
      'Babá',
      
    ]
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
      'Gesseiro',
      'Vidraceiro',
      'Serralheiro',
      'Reparos simples',
      'Técnico de ar-condicionado',
      'Técnico em eletrodomésticos',
      
    ]
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
      
    ]
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
      'Micropigmentador'
    ]
  },
   /* =========================
     Especilistas 
  ========================= */
{
  nome: 'Profissionais especializados',
  profissões: [
    'Arquiteto',
    'Engenheiro civil',
    'Engenheiro elétrico',
    'Engenheiro mecânico',
    'Advogado',
    'Contador',
    'Projetista',
    'Despachante',
    'Dedetizador',
    'Corretor de imóveis',
    'Consultor',
    
  ]
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
      'Professor'
    ]
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
      'Copywriter'
    ]
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
      'Personal trainer'
    ]
  }

];

require('dotenv').config(); //  ESSENCIAL

async function run() {
  try {

    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI não definido no .env');
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log('🔥 Conectado no Mongo');

    console.log('🔥 Limpando banco...');
    await Categoria.deleteMany({});
    await Profissao.deleteMany({});

    for (const cat of data) {

      const categoria = await Categoria.create({
        nome: cat.nome,
        slug: cat.nome.toLowerCase().replace(/\s/g, '-')
      });

      console.log(`✅ ${cat.nome}`);

      for (const nomeProf of cat.profissões) {

        await Profissao.create({
          nome: nomeProf,
          categoriaId: categoria._id
        });

        console.log(`   ↳ ${nomeProf}`);
      }

    }

    console.log('\n🚀 Seed COMPLETO ALINHADO COM APP!');

    process.exit(0);

  } catch (err) {

    console.error('❌ ERRO NO SEED:', err.message);

    process.exit(1);

  }
}

run();