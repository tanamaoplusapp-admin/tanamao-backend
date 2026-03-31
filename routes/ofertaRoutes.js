import express from 'express';
import * as OfertaController from '../controllers/ofertaController.js';

const router = express.Router();

// criar oferta do profissional
router.post('/:id', OfertaController.criar);

// listar ofertas do profissional
router.get('/:id', OfertaController.listarPorProfissional);

// editar oferta
router.put('/:ofertaId', OfertaController.atualizar);

// excluir oferta
router.delete('/:ofertaId', OfertaController.excluir);

export default router;