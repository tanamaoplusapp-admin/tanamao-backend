/**
 * ============================================================
 * TanaProfile™
 * Profile Rules
 * ------------------------------------------------------------
 * Todas as regras do Motor de Análise de Perfil.
 * Não colocar regras espalhadas pelo sistema.
 * ============================================================
 */

const PROFILE_ANALYZER_RULES = [

  {
    key: "photo",
    weight: 12,

    validate: (p) =>
      !!p.photoUrl,

    title: "Foto de Perfil",

    message:
      "Adicionar uma foto de perfil aumenta a confiança dos clientes.",

    impact:
      "Alta",

    estimatedGain: 12,

    estimatedTime: "30 segundos",
  },

  {
    key: "gallery",

    weight: 10,

    validate: (p) =>
      Array.isArray(p.galeria) &&
      p.galeria.length >= 5,

    title: "Galeria",

    message:
      "Profissionais com pelo menos 5 fotos costumam transmitir mais credibilidade.",

    impact: "Alta",

    estimatedGain: 10,

    estimatedTime: "2 minutos",
  },

  {
    key: "bio",

    weight: 10,

    validate: (p) =>
      p.bio &&
      p.bio.trim().length >= 120,

    title: "Biografia",

    message:
      "Uma biografia completa ajuda os clientes a conhecerem sua experiência.",

    impact: "Alta",

    estimatedGain: 10,

    estimatedTime: "2 minutos",
  },

  {
    key: "professions",

    weight: 8,

    validate: (p) =>
      Array.isArray(p.profissoesDetalhadas) &&
      p.profissoesDetalhadas.length > 0,

    title: "Profissões",

    message:
      "Cadastre pelo menos uma profissão para aparecer nas buscas.",

    impact: "Alta",

    estimatedGain: 8,

    estimatedTime: "1 minuto",
  },

  {
    key: "services",

    weight: 15,

    validate: (p) =>
      Array.isArray(p.servicos) &&
      p.servicos.length >= 5,

    title: "Serviços",

    message:
      "Quanto mais serviços cadastrados, maior sua chance de aparecer nas pesquisas.",

    impact: "Muito Alta",

    estimatedGain: 15,

    estimatedTime: "3 minutos",
  },

  {
    key: "attendance",

    weight: 8,

    validate: (p) => {

      if (!p.tipoAtendimento)
        return false;

      const ativos =
        Object.values(p.tipoAtendimento)
          .filter(Boolean).length;

      return ativos >= 2;

    },

    title: "Tipos de Atendimento",

    message:
      "Ofereça mais formas de atendimento para alcançar mais clientes.",

    impact: "Média",

    estimatedGain: 8,

    estimatedTime: "30 segundos",
  },

  {
    key: "payments",

    weight: 8,

    validate: (p) => {

      const total = [

        p.aceitaPix,

        p.aceitaCartao,

        p.aceitaDinheiro

      ].filter(Boolean).length;

      return total >= 2;

    },

    title: "Formas de Pagamento",

    message:
      "Aceitar mais formas de pagamento aumenta as chances de fechar serviços.",

    impact: "Média",

    estimatedGain: 8,

    estimatedTime: "30 segundos",
  },

  {
    key: "availability",

    weight: 7,

    validate: (p) =>

      p.atende24h ||
      p.atendeFimSemana ||
      p.atendeEmergencia,

    title: "Disponibilidade",

    message:
      "Informe sua disponibilidade para aparecer em mais oportunidades.",

    impact: "Média",

    estimatedGain: 7,

    estimatedTime: "30 segundos",
  },

  {
    key: "location",

    weight: 6,

    validate: (p) =>
      !!p.endereco?.cidade,

    title: "Cidade",

    message:
      "Complete seu endereço para facilitar sua localização.",

    impact: "Baixa",

    estimatedGain: 6,

    estimatedTime: "30 segundos",
  },

];

const PROFILE_LEVELS = [

  {
    name: "Iniciante",
    min: 0,
    color: "#9E9E9E",
  },

  {
    name: "Bom",
    min: 50,
    color: "#03A9F4",
  },

  {
    name: "Excelente",
    min: 75,
    color: "#4CAF50",
  },

  {
    name: "Diamante",
    min: 90,
    color: "#FFC107",
  },

];

module.exports = {

  PROFILE_ANALYZER_RULES,

  PROFILE_LEVELS,

};