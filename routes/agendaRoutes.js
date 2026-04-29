const express = require('express');
const router = express.Router();

const controller = require('../controllers/agendaController');
const verifyToken = require('../middleware/verifyToken');

// CRIAR AGENDAMENTO
router.post('/', verifyToken, controller.criar);
router.post('/convite/:token/aceitar', verifyToken, controller.aceitarConvite);
// LISTAR DO PROFISSIONAL
router.get('/me', verifyToken, controller.listar);

// LISTAR DO CLIENTE
router.get('/cliente', verifyToken, controller.listarCliente);

// 🔥 ABRIR CHAT PELO AGENDAMENTO
router.post('/:id/chat', verifyToken, controller.abrirChatCliente);

// EDITAR
router.put('/:id', verifyToken, controller.editar);

// CANCELAR
router.delete('/:id', verifyToken, controller.cancelar);

module.exports = router;