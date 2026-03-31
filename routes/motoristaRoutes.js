const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/verifyToken");
const requireRole = require("../middleware/requireRole");
const motoristaController = require("../controllers/motoristaController");

/* ============================================================================
 * 🔐 TODAS AS ROTAS AQUI EXIGEM AUTH
 * ==========================================================================*/
router.use(verifyToken);

/* ============================================================================
 * 👤 PERFIL DO MOTORISTA (APP)
 * ==========================================================================*/

/**
 * GET /api/motoristas/me
 * Retorna perfil do motorista logado
 */
router.get("/me", motoristaController.getPerfilMotorista);

/**
 * PUT /api/motoristas/me
 * Atualiza perfil do motorista logado
 */
router.put("/me", motoristaController.atualizarPerfilMotorista);

/* ============================================================================
 * 🧾 DOCUMENTOS / VEÍCULO
 * ==========================================================================*/

/**
 * POST /api/motoristas/validar-cnh
 */
router.post("/validar-cnh", motoristaController.validarCNH);

/**
 * PUT /api/motoristas/documentos
 */
router.put(
  "/documentos",
  motoristaController.atualizarDocumentosMotorista
);

/* ============================================================================
 * 🟢 STATUS ONLINE / PRESENÇA
 * ==========================================================================*/

/**
 * GET /api/motoristas/status
 */
router.get("/status", async (req, res) => {
  return res.json({
    online: Boolean(req.user?.online ?? true),
    lastSeen: new Date(),
  });
});

/**
 * POST /api/motoristas/status
 * body: { online: true|false }
 */
router.post("/status", async (req, res) => {
  try {
    const online = Boolean(req.body?.online);
    return res.json({ online });
  } catch (e) {
    return res.status(500).json({ message: "Erro ao atualizar status." });
  }
});

/* ============================================================================
 * 📦 PEDIDOS / ENTREGAS
 * ==========================================================================*/

/**
 * GET /api/motoristas/pedidos
 */
router.get("/pedidos", motoristaController.getPedidosMotorista);

/**
 * GET /api/motoristas/resumo
 */
router.get("/resumo", motoristaController.getResumoMotorista);

/**
 * GET /api/motoristas/historico
 */
router.get(
  "/historico",
  motoristaController.getHistoricoEntregas
);

/* ============================================================================
 * 💰 DADOS BANCÁRIOS
 * ==========================================================================*/

/**
 * PUT /api/motoristas/banco
 */
router.put("/banco", async (req, res) => {
  try {
    const data = {
      banco: req.body?.banco,
      agencia: req.body?.agencia,
      conta: req.body?.conta,
      tipoConta: req.body?.tipoConta,
      pix: req.body?.pix || null,
    };

    req.body = data;
    return motoristaController.atualizarPerfilMotorista(req, res);
  } catch (e) {
    console.error("[motoristas/banco]", e);
    return res
      .status(500)
      .json({ message: "Erro ao salvar dados bancários." });
  }
});

/* ============================================================================
 * 🛠️ ADMIN / BACKOFFICE
 * Usa requireRole (permission-based)
 * ==========================================================================*/

/**
 * GET /api/motoristas
 */
router.get(
  "/",
  requireRole("motoristas:listar"),
  motoristaController.getMotoristas
);

/**
 * GET /api/motoristas/:id
 */
router.get(
  "/:id",
  requireRole("motoristas:ver"),
  motoristaController.getMotoristaById
);

/**
 * PUT /api/motoristas/:id
 */
router.put(
  "/:id",
  requireRole("motoristas:editar"),
  motoristaController.updateMotorista
);

/**
 * PUT /api/motoristas/:id/aprovar
 */
router.put(
  "/:id/aprovar",
  requireRole("motoristas:aprovar"),
  motoristaController.aprovarMotorista
);

/**
 * DELETE /api/motoristas/:id
 */
router.delete(
  "/:id",
  requireRole("motoristas:deletar"),
  motoristaController.deleteMotorista
);

module.exports = router;
