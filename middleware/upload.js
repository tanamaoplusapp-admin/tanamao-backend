// middlewares/upload.js
const multer = require('multer');
const path = require('path');
const config = require('../config/env');

// === Configs ===
const MAX_MB = Number(config?.files?.maxUploadSizeMb || 10); // fallback 10MB
const FILE_SIZE = MAX_MB * 1024 * 1024;

// imagens + pdf (CNH/contratos). Ajuste se quiser restringir.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

// extensão de apoio (não é decisivo, apenas ajuda)
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf']);

// === Storage na memória (ideal para enviar ao Cloudinary/S3 sem gravar em disco) ===
const storage = multer.memoryStorage();

// === Filtro básico por mime/ext (sincrono). Opcionalmente complemente com checagem de magic-bytes pós-upload. ===
function fileFilter(req, file, cb) {
  const { mimetype, originalname = '' } = file || {};
  const ext = path.extname(originalname || '').toLowerCase();

  if (!ALLOWED_MIME.has(mimetype) || (ext && !ALLOWED_EXT.has(ext))) {
    return cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Tipo de arquivo não permitido: ${mimetype || ext || 'desconhecido'}`
      )
    );
  }
  cb(null, true);
}

// === Instância base do Multer ===
const upload = multer({
  storage,
  limits: { fileSize: FILE_SIZE },
  fileFilter,
});

// === Helpers prontos para usar nos routers ===
const uploadImageSingle = (field = 'image') => upload.single(field);
const uploadImagesArray = (field = 'images', maxCount = 5) => upload.array(field, maxCount);
// Ex.: uploadFields([{ name: 'images', maxCount: 5 }, { name: 'doc', maxCount: 1 }])
const uploadFields = (fields) => upload.fields(fields);

// === Handler padronizado de erros do Multer (use após as rotas de upload) ===
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    // Tipos comuns: LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE, ...
    const code = err.code || 'UPLOAD_ERROR';
    const message =
      code === 'LIMIT_FILE_SIZE'
        ? `Arquivo excede ${MAX_MB}MB`
        : err.message || 'Falha no upload';
    return res.status(400).json({ error: message, code });
  }
  // outros erros
  return next(err);
}

// === (Opcional) verificação de magic-bytes pós-upload, se quiser endurecer a validação.
// Requer o pacote "file-type" instalado (npm i file-type).
let fileTypeFromBuffer = null;
try {
  ({ fileTypeFromBuffer } = require('file-type'));
} catch (_) {
  // se a lib não estiver instalada, seguimos só com o mimetype/ext
}

/**
 * Verifica buffers enviados (req.file/req.files) por assinatura (magic-bytes).
 * Use APÓS o middleware de upload.
 * Ex.: router.post('/produtos', uploadImageSingle('image'), verifyUploads(), controller)
 */
function verifyUploads() {
  return async (req, res, next) => {
    if (!fileTypeFromBuffer) return next(); // sem a lib, pulamos

    try {
      const files = [];

      if (req.file) files.push(req.file);
      if (Array.isArray(req.files)) files.push(...req.files);
      if (!req.file && req.files && typeof req.files === 'object') {
        // fields(): { field: [..files] }
        Object.values(req.files).forEach((arr) => Array.isArray(arr) && files.push(...arr));
      }

      for (const f of files) {
        if (!f?.buffer) continue;
        const ft = await fileTypeFromBuffer(f.buffer);
        if (!ft || !ALLOWED_MIME.has(ft.mime)) {
          return res.status(400).json({
            error: `Arquivo inválido ou não suportado (detectado: ${ft?.mime || 'desconhecido'})`,
          });
        }
      }

      return next();
    } catch (e) {
      return res.status(400).json({ error: 'Falha ao validar arquivo enviado' });
    }
  };
}

module.exports = upload;
// compat + helpers
module.exports.upload = upload;
module.exports.uploadImageSingle = uploadImageSingle;
module.exports.uploadImagesArray = uploadImagesArray;
module.exports.uploadFields = uploadFields;
module.exports.handleMulterError = handleMulterError;
module.exports.verifyUploads = verifyUploads;
