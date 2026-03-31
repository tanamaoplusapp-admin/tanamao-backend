const path = require('path');
const fs = require('fs');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const empresaId = req.body?.empresaId || req.query?.empresaId || 'unknown';
    const baseDir = path.resolve('imports', empresaId);
    await fs.promises.mkdir(baseDir, { recursive: true });
    cb(null, baseDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.csv';
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});
const fileFilter = (_req, file, cb) => {
  const ok = /(\.csv|\.csv\.gz)$/i.test(file.originalname);
  cb(ok ? null : new Error('Apenas .csv ou .csv.gz'), ok);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
