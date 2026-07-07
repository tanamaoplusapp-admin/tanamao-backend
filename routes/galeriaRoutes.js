const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/verifyToken');

const ctrl = require('../controllers/galeriaController');


/**
 * POST /api/galeria
 * Criar novo destaque
 */
router.post(
  '/',
  verifyToken,
  ctrl.criarDestaque
);


/**
 * GET /api/galeria/me
 * Listar os destaques do profissional logado
 *
 * IMPORTANTE:
 * Deve ficar antes da rota /:id
 */
router.get(
  '/me',
  verifyToken,
  ctrl.listarMeusDestaques
);


/**
 * GET /api/galeria/profissional/:profissionalId
 * Listar destaques públicos de um profissional
 */
router.get(
  '/profissional/:profissionalId',
  ctrl.listarDestaquesPublicos
);


/**
 * GET /api/galeria/:id
 * Buscar um destaque específico
 */
router.get(
  '/:id',
  verifyToken,
  ctrl.buscarMeuDestaque
);


/**
 * PUT /api/galeria/:id
 * Editar nome, ordem ou status do destaque
 */
router.put(
  '/:id',
  verifyToken,
  ctrl.editarDestaque
);


/**
 * POST /api/galeria/:id/fotos
 * Adicionar novas fotos a um destaque
 */
router.post(
  '/:id/fotos',
  verifyToken,
  ctrl.adicionarFotos
);


/**
 * DELETE /api/galeria/:id/fotos/:fotoId
 * Remover uma foto específica do destaque
 */
router.delete(
  '/:id/fotos/:fotoId',
  verifyToken,
  ctrl.removerFoto
);


/**
 * PUT /api/galeria/:id/capa
 * Alterar a capa do destaque
 */
router.put(
  '/:id/capa',
  verifyToken,
  ctrl.alterarCapa
);


/**
 * DELETE /api/galeria/:id
 * Excluir o destaque inteiro
 */
router.delete(
  '/:id',
  verifyToken,
  ctrl.excluirDestaque
);


module.exports = router;