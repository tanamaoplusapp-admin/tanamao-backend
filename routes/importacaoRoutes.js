const express = require('express');
const router = express.Router();
const uploadCsv = require('../middleware/uploadCsv');
const { startCsvImport, getImportStatus } = require('../controllers/importacaoController');

// POST /api/integracoes/import/csv  (form-data: empresaId, file=<csv/csv.gz>)
router.post('/api/integracoes/import/csv', uploadCsv.single('file'), startCsvImport);

// GET /api/integracoes/import/:jobId/status
router.get('/api/integracoes/import/:jobId/status', getImportStatus);

module.exports = router;
