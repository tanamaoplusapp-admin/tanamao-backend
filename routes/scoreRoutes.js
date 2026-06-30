const express = require("express");
const router = express.Router();

const scoreController = require("../controllers/scoreController");
const { verifyToken } = require("../middleware/verifyToken");

/* ======================================================
   TanaScore
====================================================== */

/**
 * Consultar score de um profissional
 */
router.get(
  "/:profissionalId",
  verifyToken,
  scoreController.getScore
);

/**
 * Recalcular score de um profissional
 */
router.put(
  "/:profissionalId/recalculate",
  verifyToken,
  scoreController.updateScore
);
router.get(
  "/me",
  verifyToken,
  scoreController.getMyEvolution
);
/**
 * Recalcular score de todos os profissionais
 * (uso administrativo)
 */
router.put(
  "/recalculate/all",
  verifyToken,
  scoreController.updateAllScores
);

module.exports = router;