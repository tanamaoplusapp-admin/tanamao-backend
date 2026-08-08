const express = require('express');
const { Types } = require('mongoose');

const router = express.Router();

/* ================= AUTH ================= */

let verifyToken;

try {
  const auth = require('../middleware/verifyToken');
  verifyToken = auth.verifyToken;
} catch (_) {
  verifyToken = require('../middleware/verifyToken');
}

if (typeof verifyToken !== 'function') {
  throw new Error(
    '[orcamentoRoutes] Middleware verifyToken não encontrado.'
  );
}

/* ================= CONTROLLER ================= */

const controller = require('../controllers/orcamentoController');

const {
  criarOrcamento,
  listarOrcamentos,
  buscarOrcamento,
  atualizarOrcamento,
  excluirOrcamento,
  duplicarOrcamento,
  compartilharOrcamento,
  favoritarOrcamento,
  desfavoritarOrcamento,
  gerarPdf,
} = controller;

/* ================= PARAM ================= */

router.param(
  'orcamentoId',
  (req, res, next, value) => {
    if (!Types.ObjectId.isValid(String(value))) {
      return res.status(400).json({
        error: 'orcamentoId inválido',
      });
    }

    next();
  }
);

/* =====================================================
   ROTAS
===================================================== */

/**
 * Criar orçamento
 */
router.post(
  '/',
  verifyToken,
  criarOrcamento
);

/**
 * Listar meus orçamentos
 */
router.get(
  '/',
  verifyToken,
  listarOrcamentos
);

/**
 * Buscar orçamento
 */
router.get(
  '/:orcamentoId',
  verifyToken,
  buscarOrcamento
);

/**
 * Atualizar orçamento
 */
router.put(
  '/:orcamentoId',
  verifyToken,
  atualizarOrcamento
);

/**
 * Excluir orçamento
 */
router.delete(
  '/:orcamentoId',
  verifyToken,
  excluirOrcamento
);

/**
 * Duplicar orçamento
 */
router.post(
  '/:orcamentoId/duplicar',
  verifyToken,
  duplicarOrcamento
);

/**
 * Gerar PDF
 */
router.post(
  '/:orcamentoId/pdf',
  verifyToken,
  gerarPdf
);

/**
 * Compartilhar orçamento
 */
router.post(
  '/:orcamentoId/compartilhar',
  verifyToken,
  compartilharOrcamento
);

/**
 * Favoritar orçamento
 */
router.patch(
  '/:orcamentoId/favorito',
  verifyToken,
  favoritarOrcamento
);

/**
 * Desfavoritar orçamento
 */
router.delete(
  '/:orcamentoId/favorito',
  verifyToken,
  desfavoritarOrcamento
);

module.exports = router;