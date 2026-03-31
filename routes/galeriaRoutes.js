const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/verifyToken');

const ctrl = require('../controllers/galeriaController');

/**
 * POST /api/galeria
 * Adicionar foto
 */
router.post('/', verifyToken, ctrl.adicionarFoto);

/**
 * GET /api/galeria/:profissionalId
 * Ver galeria pública
 */
router.get('/:profissionalId', ctrl.listarGaleria);

/**
 * DELETE /api/galeria/:id
 * Remover foto
 */
router.delete('/:id', verifyToken, ctrl.removerFoto);

module.exports = router;