/**
 * Minha evolução
 */
router.get(
  "/me",
  verifyToken,
  scoreController.getMyEvolution
);

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

/**
 * Recalcular score de todos
 */
router.put(
  "/recalculate/all",
  verifyToken,
  scoreController.updateAllScores
);