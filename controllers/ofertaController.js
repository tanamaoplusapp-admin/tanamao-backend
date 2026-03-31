const Oferta = require('../models/Oferta');

/* ================================
   CRIAR OFERTA
================================ */
exports.criar = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ID do profissional inválido',
      });
    }

    const { titulo, descricao, preco, status, visivelNoPerfil } = req.body;

    if (!titulo || !descricao || typeof preco !== 'number') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Campos obrigatórios inválidos',
      });
    }

    const oferta = await Oferta.create({
  profissionalId: id, // ✅ nome correto do campo
  titulo,
  descricao,
  preco,
  status: status || 'ativa',
  visivelNoPerfil: visivelNoPerfil !== false,
});

    return res.status(201).json(oferta);
  } catch (e) {
    console.error('Erro ao criar oferta:', e);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Não foi possível criar a oferta',
    });
  }
};

/* ================================
   LISTAR OFERTAS POR PROFISSIONAL
================================ */
exports.listarPorProfissional = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ID do profissional inválido',
      });
    }

    const ofertas = await Oferta.find({
      profissionalId: id,
      status: 'ativa',
      visivelNoPerfil: true,
    }).sort({ createdAt: -1 });

    return res.json(ofertas);
  } catch (e) {
    console.error('Erro ao listar ofertas:', e);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Erro ao listar ofertas',
    });
  }
};
/* ================================
   ATUALIZAR OFERTA
================================ */
exports.atualizar = async (req, res) => {
  try {
    const { ofertaId } = req.params;

    if (!ofertaId || !ofertaId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ID da oferta inválido',
      });
    }

    const oferta = await Oferta.findByIdAndUpdate(
      ofertaId,
      req.body,
      { new: true }
    );

    if (!oferta) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Oferta não encontrada',
      });
    }

    return res.json(oferta);
  } catch (e) {
    console.error('Erro ao atualizar oferta:', e);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Erro ao atualizar oferta',
    });
  }
};

/* ================================
   EXCLUIR OFERTA
================================ */
exports.excluir = async (req, res) => {
  try {
    const { ofertaId } = req.params;

    if (!ofertaId || !ofertaId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ID da oferta inválido',
      });
    }

    const oferta = await Oferta.findByIdAndDelete(ofertaId);

    if (!oferta) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Oferta não encontrada',
      });
    }

    return res.status(204).send();
  } catch (e) {
    console.error('Erro ao excluir oferta:', e);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Erro ao excluir oferta',
    });
  }
};