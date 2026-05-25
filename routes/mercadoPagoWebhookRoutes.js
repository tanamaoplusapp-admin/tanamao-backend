const express = require('express');
const router = express.Router();
const controller = require('../controllers/mercadoPagoWebhookController');

// Mercado Pago exige POST público
router.post('/', controller.webhook);
module.exports = router;