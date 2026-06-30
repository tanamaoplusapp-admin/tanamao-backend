/**
 * ============================================================
 * TanaScore™
 * Configuração central de regras
 * ============================================================
 */

const MODULE_WEIGHTS = {

  profile: 0.25,

  security: 0.10,

  experience: 0.15,

  reviews: 0.30,

  punctuality: 0.08,

  cancellations: 0.06,

  response: 0.06,

};

/* ============================================================
   PERFIL
============================================================ */

const PROFILE_RULES = {

  photo: 15,

  description: 15,

  phone: 5,

  cities: 10,

  professions: 15,

  specialties: 10,

  services: 10,

  gallery: 10,

  galleryMin: 3,

};

/* ============================================================
   SEGURANÇA
============================================================ */

const SECURITY_RULES = {

  email: 25,

  phone: 25,

  document: 25,

  selfie: 25,

};

/* ============================================================
   NÍVEIS
============================================================ */

const LEVELS = [

  {
    name: "Inicial",
    min: 0,
    max: 39,
    color: "#9E9E9E",
  },

  {
    name: "Bronze",
    min: 40,
    max: 59,
    color: "#CD7F32",
  },

  {
    name: "Prata",
    min: 60,
    max: 69,
    color: "#B0BEC5",
  },

  {
    name: "Ouro",
    min: 70,
    max: 79,
    color: "#F9A825",
  },

  {
    name: "Platina",
    min: 80,
    max: 89,
    color: "#90CAF9",
  },

  {
    name: "Diamante",
    min: 90,
    max: 94,
    color: "#26C6DA",
  },

  {
    name: "Elite",
    min: 95,
    max: 100,
    color: "#7E57C2",
  },

];

/* ============================================================
   CURVA DE EXPERIÊNCIA
============================================================ */

function experienceCurve(total) {

  total = Number(total || 0);

  if (total <= 0) return 0;

  if (total <= 5) return 20;

  if (total <= 10) return 35;

  if (total <= 20) return 50;

  if (total <= 40) return 65;

  if (total <= 80) return 80;

  if (total <= 150) return 90;

  return 100;

}

/* ============================================================
   CURVA DE AVALIAÇÕES
============================================================ */

function reviewCurve(totalAvaliacoes) {

  totalAvaliacoes = Number(totalAvaliacoes || 0);

  if (totalAvaliacoes <= 0) return 0;

  if (totalAvaliacoes <= 5) return 10;

  if (totalAvaliacoes <= 10) return 15;

  if (totalAvaliacoes <= 20) return 20;

  if (totalAvaliacoes <= 40) return 25;

  return 30;

}

module.exports = {

  PROFILE_RULES,

  SECURITY_RULES,

  MODULE_WEIGHTS,

  LEVELS,

  reviewCurve,

  experienceCurve,

};