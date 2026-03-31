const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { requireRoles } = require('../middleware/verifyToken');

const { ingest, list } = require('../controllers/auditoriaController');

// POST /api/auditoria - qualquer usuário autenticado pode registrar eventos
router.post('/', verifyToken, ingest);

// GET /api/auditoria - apenas admins podem listar
router.get('/', verifyToken, requireRoles('admin'), list);

module.exports = router;
