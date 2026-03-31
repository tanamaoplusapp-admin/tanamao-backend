const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/verifyToken');
const centralMensalidadeController = require('../controllers/centralMensalidadeController');

// Todas as rotas aqui são protegidas para o app admin
router.use(verifyToken);

router.get('/resumo', centralMensalidadeController.resumoMensalidades);
router.get('/atrasadas', centralMensalidadeController.listAtrasadas);

module.exports = router;
