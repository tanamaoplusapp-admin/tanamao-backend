const express = require("express");
const router = express.Router();

const scoreController = require("../controllers/scoreController");
const { verifyToken } = require("../middleware/verifyToken");

console.log("🔥 SCORE ROUTES CARREGADO");

/* ======================================================
   Minha Evolução
====================================================== */

router.get(
  "/me",
  verifyToken,
  (req, res, next) => {
    console.log("🔥 PASSOU NA ROTA /api/score/me");
    next();
  },
  scoreController.getMyEvolution
);

/* ======================================================
   Consultar score de um profissional
====================================================== */

router.get(
  "/:profissionalId",
  verifyToken,
  (req, res, next) => {
    console.log("🔥 PASSOU NA ROTA /api/score/:profissionalId");
    next();
  },
  scoreController.getScore
);

/* ======================================================
   Recalcular score de um profissional
====================================================== */

router.put(
  "/:profissionalId/recalculate",
  verifyToken,
  scoreController.updateScore
);

/* ======================================================
   Recalcular score de todos
====================================================== */

router.put(
  "/recalculate/all",
  verifyToken,
  scoreController.updateAllScores
);

module.exports = router;