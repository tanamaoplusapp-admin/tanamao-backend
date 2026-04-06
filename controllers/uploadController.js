// controllers/uploadController.js
const { v4: uuid } = require('uuid');
const User = require('../models/user');
const cloudinary = require('../config/cloudinary');

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

    // tipo da imagem (perfil | galeria)
    const tipo = req.body?.tipo || 'galeria';

    // Validação simples
    const isImage =
      (file.mimetype && file.mimetype.startsWith('image/')) ||
      (file.originalname &&
        /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?)$/i.test(file.originalname));

    if (!isImage) {
      return res.status(415).json({
        error: 'Tipo de arquivo não suportado. Envie uma imagem.',
      });
    }

    // precisa existir buffer para enviar ao Cloudinary
    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      return res.status(400).json({
        error: 'Arquivo inválido (sem buffer)',
      });
    }

    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype || 'image/jpeg'};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'tanamao',
      public_id: `${tipo}_${uuid()}`,
      resource_type: 'image',
    });

    const url = result.secure_url;

    // salva avatar do usuário quando for foto de perfil
    if (tipo === 'perfil' && req.user?._id) {
      await User.findByIdAndUpdate(
        req.user._id,
        { avatar: url },
        { new: true }
      );
    }

    // mantém contrato original
    return res.status(201).json({ url, tipo });

  } catch (e) {
    console.error('upload erro', e);
    return res.status(500).json({ error: 'Falha no upload' });
  }
};