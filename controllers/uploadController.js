// controllers/uploadController.js
const { v4: uuid } = require('uuid');
const User = require('../models/user'); // ✅ adicionado
// opcional: const cloudinary = require('../services/cloudinary');

exports.uploadOne = async (req, res) => {
  try {
    // Compat: alguns setups usam upload.any() e populam req.files
    if (!req.file && Array.isArray(req.files) && req.files.length > 0) {
      req.file = req.files[0];
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo ausente' });
    }

    const file = req.file;

    // 🔥 NOVO: tipo da imagem (perfil | galeria)
    const tipo = req.body?.tipo || 'galeria';

    // Validação simples de tipo (mantém contrato e evita salvar não-imagem)
    const isImage =
      (file.mimetype && file.mimetype.startsWith('image/')) ||
      (file.originalname && /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?)$/i.test(file.originalname));

    if (!isImage) {
      return res.status(415).json({ error: 'Tipo de arquivo não suportado. Envie uma imagem.' });
    }

    // Extrai extensão a partir do mimetype ou do nome original
    const guessExtFromMime = (mt) => {
      if (!mt) return null;
      if (mt === 'image/png') return 'png';
      if (mt === 'image/jpeg') return 'jpg';
      if (mt === 'image/jpg') return 'jpg';
      if (mt === 'image/webp') return 'webp';
      if (mt === 'image/gif') return 'gif';
      if (mt === 'image/bmp') return 'bmp';
      if (mt === 'image/heic') return 'heic';
      if (mt === 'image/heif') return 'heif';
      if (mt === 'image/tiff') return 'tif';
      return null;
    };

    let ext =
      guessExtFromMime(file.mimetype) ||
      (file.originalname && (file.originalname.split('.').pop() || '').toLowerCase()) ||
      'jpg'; // fallback

    // Se vier "jpeg", padroniza para "jpg"
    if (ext === 'jpeg') ext = 'jpg';

    // Exemplo local (dev): salvar em /uploads e montar URL pública
    const path = require('path');
    const fs = require('fs');

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const name = `${uuid()}.${ext}`;
    const filePath = path.join(uploadsDir, name);

    // Segurança: garante que temos um buffer
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      return res.status(400).json({ error: 'Arquivo inválido (sem buffer)' });
    }

    fs.writeFileSync(filePath, file.buffer);

    // URL pública servida pelo express.static('/uploads', ...)
    const url = `${process.env.APP_BASE_URL}/uploads/${name}`;

    // ✅ NOVO — salva avatar do usuário quando for foto de perfil
    if (tipo === 'perfil' && req.user?._id) {
      await User.findByIdAndUpdate(
        req.user._id,
        { avatar: url },
        { new: true }
      );
    }

    // 🔥 IMPORTANTE:
    // Mantém contrato original + já devolve tipo (não quebra nada existente)
    return res.status(201).json({ url, tipo });

  } catch (e) {
    console.error('upload erro', e);
    return res.status(500).json({ error: 'Falha no upload' });
  }
};