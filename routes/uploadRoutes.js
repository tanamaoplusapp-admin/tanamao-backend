const express = require('express');
const multer = require('multer');

const router = express.Router();

/* ================= CONTROLLER ================= */

const uploadController = require('../controllers/uploadController');

/* ================= MIDDLEWARE ================= */

const { verifyToken } = require('../middleware/verifyToken'); // ✅ adicionado

/* ================= MULTER ================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/* ================= ROTAS ================= */

// Preflight CORS
router.options('/', (_req, res) => res.sendStatus(204));

// Health check
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    route: '/api/upload',
    ts: new Date().toISOString(),
  });
});

/**
 * POST /api/upload
 * Campo esperado: "file" ou "image"
 * Token opcional (se existir salva avatar)
 */
router.post(
  '/',
  (req, res, next) => {
    // tenta verificar token mas não bloqueia se não tiver
    verifyToken(req, res, (err) => {
      next();
    });
  },
  upload.any(),
  (req, _res, next) => {

    if (!req.file && Array.isArray(req.files) && req.files.length > 0) {

      const fromFile = req.files.find(f => f.fieldname === 'file');
      const fromImage = req.files.find(f => f.fieldname === 'image');

      req.file = fromFile || fromImage || req.files[0];

    }

    next();

  },
  uploadController.uploadOne
);

module.exports = router;