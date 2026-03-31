const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/verifyToken');
const presencaCtrl = require('../controllers/presencaController');

// Status do profissional
router.get('/me', verifyToken, presencaCtrl.getStatus);         // Obter status atual
router.patch('/me', verifyToken, presencaCtrl.setStatus);       // Alterar status

module.exports = router;
