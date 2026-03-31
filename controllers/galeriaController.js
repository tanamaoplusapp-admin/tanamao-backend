const Galeria = require('../models/Galeria');

/**
 * POST /api/galeria
 */
exports.adicionarFoto = async (req, res, next) => {
  try {

    const profissionalId = req.user?.id || req.user?._id;

    const { url, descricao } = req.body;

    if (!url) {
      return res.status(400).json({
        message: 'URL da imagem é obrigatória',
      });
    }

    const foto = await Galeria.create({
      profissional: profissionalId,
      url,
      descricao,
    });

    return res.status(201).json({
      foto,
    });

  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/galeria/:profissionalId
 */
exports.listarGaleria = async (req, res, next) => {

  try {

    const { profissionalId } = req.params;

    const fotos = await Galeria.find({
      profissional: profissionalId,
    }).sort({ ordem: 1, createdAt: -1 });

    return res.json({
      fotos,
    });

  } catch (err) {
    next(err);
  }

};


/**
 * DELETE /api/galeria/:id
 */
exports.removerFoto = async (req, res, next) => {

  try {

    const { id } = req.params;

    const foto = await Galeria.findById(id);

    if (!foto) {
      return res.status(404).json({
        message: 'Foto não encontrada',
      });
    }

    await foto.deleteOne();

    return res.json({
      message: 'Foto removida com sucesso',
    });

  } catch (err) {
    next(err);
  }

};