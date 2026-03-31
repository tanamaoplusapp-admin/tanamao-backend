const express = require('express');
const verifyHmac = require('../middleware/verifyHmac');
const requireIdempotency = require('../middleware/requireIdempotency');
const { bulkUpsert, bulkInventory } = require('../controllers/productBulkController');

const router = express.Router();

router.post('/api/products/bulk', verifyHmac, requireIdempotency, bulkUpsert);
router.post('/api/inventory/bulk', verifyHmac, requireIdempotency, bulkInventory);

module.exports = router;
