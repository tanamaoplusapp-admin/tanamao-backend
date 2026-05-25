const express = require('express');
const router = express.Router();
const controller = require('../controllers/mercadoPagoWebhookController');

router.post('/', controller.webhook);

module.exports = router;