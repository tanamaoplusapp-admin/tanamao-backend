const express = require("express");
const router = express.Router();

const profileAnalyzerController = require(
  "../controllers/profileAnalyzerController"
);

const { verifyToken } = require("../middleware/verifyToken");

console.log("🔥 PROFILE ANALYZER ROUTES CARREGADO");

/* ======================================================
   Minha Análise Inteligente
====================================================== */

router.get(
  "/analyze",
  verifyToken,
  (req, res, next) => {
    console.log("🔥 PASSOU NA ROTA /api/profile/analyze");
    next();
  },
  profileAnalyzerController.getMyProfileAnalysis
);

/* ======================================================
   Resumo Rápido
====================================================== */

router.get(
  "/summary",
  verifyToken,
  (req, res, next) => {
    console.log("🔥 PASSOU NA ROTA /api/profile/summary");
    next();
  },
  profileAnalyzerController.getQuickSummary
);

/* ======================================================
   Análise de um Profissional
====================================================== */

router.get(
  "/:profissionalId",
  verifyToken,
  (req, res, next) => {
    console.log("🔥 PASSOU NA ROTA /api/profile/:profissionalId");
    next();
  },
  profileAnalyzerController.getProfessionalAnalysis
);

/* ======================================================
   Reanalisar Perfil
====================================================== */

router.put(
  "/:profissionalId/refresh",
  verifyToken,
  profileAnalyzerController.refreshAnalysis
);

module.exports = router;