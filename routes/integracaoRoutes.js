const express = require('express');
const { saveErpToken, getStatus, uploadCsv } = require('../controllers/integracaoController');
const upload = require('../middleware/upload'); // multer

const router = express.Router();

router.post('/api/integracoes/erp/token', saveErpToken);
router.get('/api/integracoes/status', getStatus);
router.post('/api/integracoes/upload', upload.single('file'), uploadCsv);

module.exports = router;
