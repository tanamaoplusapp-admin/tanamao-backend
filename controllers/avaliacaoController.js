// controllers/avaliacaoController.js
const mongoose = require('mongoose');
const Avaliacao = require('../models/Avaliacao');
const Servico = require('../models/Servico');

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

/**
 * GET /api/avaliacoes/motorista/:id
 */
exports.getAvaliacoesPorMotorista = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ error: 'ID de motorista inválido.' });
    }

    const q = { motorista: id };

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const sort = { createdAt: -1 };

    const [items, total] = await Promise.all([
      Avaliacao.find(q).sort(sort).skip(skip).limit(limit).lean(),
      Avaliacao.countDocuments(q),
    ]);

    if (String(req.query.withMeta || '').toLowerCase() === 'true') {
      const stats = await Avaliacao.aggregate([
        { $match: { motorista: new mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            media: { $avg: '$nota' },
            n1: { $sum: { $cond: [{ $eq: ['$nota', 1] }, 1, 0] } },
            n2: { $sum: { $cond: [{ $eq: ['$nota', 2] }, 1, 0] } },
            n3: { $sum: { $cond: [{ $eq: ['$nota', 3] }, 1, 0] } },
            n4: { $sum: { $cond: [{ $eq: ['$nota', 4] }, 1, 0] } },
            n5: { $sum: { $cond: [{ $eq: ['$nota', 5] }, 1, 0] } },
          },
        },
      ]);

      const s = stats[0] || { total: 0, media: null, n1: 0, n2: 0, n3: 0, n4: 0, n5: 0 };

      return res.json({
        items,
        meta: {
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
          stats: {
            total: s.total,
            media: s.media ? Number(s.media.toFixed(2)) : null,
            distribuicao: { 1: s.n1, 2: s.n2, 3: s.n3, 4: s.n4, 5: s.n5 },
          },
        },
      });
    }

    return res.json(items);
  } catch (err) {
    console.error('Erro ao buscar avaliações do motorista:', err);
    return res.status(500).json({ error: 'Erro ao carregar avaliações' });
  }
};

/**
 * GET /api/avaliacoes/profissional/:id
 */
exports.getAvaliacoesPorProfissional = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'ID de profissional inválido.',
      });
    }

    const servicos = await Servico.find({
      $or: [
        { profissional: id },
        { profissionalId: id },
        { prestador: id },
        { prestadorId: id },
      ],
    })
      .select('_id descricao categoria createdAt')
      .lean();

    const servicoIds = servicos.map((s) => s._id);

    const items = await Avaliacao.find({
      pedido: { $in: servicoIds },
    })
      .populate('cliente', 'name nome email')
      .sort({ createdAt: -1 })
      .lean();

    const total = items.length;

    const media =
      total > 0
        ? items.reduce((acc, item) => acc + Number(item.nota || 0), 0) / total
        : 0;

    return res.json({
      items,
      meta: {
        total,
        media: Number(media.toFixed(1)),
      },
    });
  } catch (err) {
    console.error('Erro ao buscar avaliações do profissional:', err);

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Erro ao carregar avaliações do profissional.',
    });
  }
};

/**
 * POST /api/avaliacoes
 */
exports.createAvaliacaoGeneric = async (req, res) => {
  try {
    const authUserId = req.userId || req.user?._id || req.user?.id || null;

    const {
      motoristaId, motorista,
      companyId,
      pedidoId,
      productId,
      estrelas, rating, nota: notaBody,
      comentario, comment,
      clienteId,
    } = req.body || {};

    const notaInput = Number(estrelas ?? rating ?? notaBody);

    if (!Number.isFinite(notaInput) || notaInput < 1 || notaInput > 5) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Nota deve ser um número entre 1 e 5.',
      });
    }

    const nota = Math.round(notaInput);
    const texto = (comentario ?? comment ?? '').trim();
    const cliente = (clienteId && isObjectId(clienteId)) ? clienteId : authUserId;

    if (!cliente) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Sessão inválida.',
      });
    }

    if (motoristaId || motorista) {
      const id = motoristaId || motorista;

      if (!isObjectId(id)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'motoristaId inválido.',
        });
      }

      const existe = await Avaliacao.findOne({ motorista: id, cliente });

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou este motorista.',
        });
      }

      const doc = await Avaliacao.create({
        motorista: id,
        cliente,
        nota,
        comentario: texto,
      });

      return res.status(201).json({
        message: 'Avaliação registrada',
        avaliacao: doc,
      });
    }

    if (companyId) {
      if (!isObjectId(companyId)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'companyId inválido.',
        });
      }

      const filtroDuplicidade = { empresa: companyId, cliente };

      if (productId && isObjectId(productId)) {
        filtroDuplicidade.produto = productId;
      }

      const existe = await Avaliacao.findOne(filtroDuplicidade);

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou esta empresa/produto.',
        });
      }

      const doc = await Avaliacao.create({
        empresa: companyId,
        produto: productId && isObjectId(productId) ? productId : undefined,
        cliente,
        nota,
        comentario: texto,
      });

      return res.status(201).json({
        message: 'Avaliação registrada',
        avaliacao: doc,
      });
    }

    if (pedidoId) {
      if (!isObjectId(pedidoId)) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'pedidoId inválido.',
        });
      }

      const existe = await Avaliacao.findOne({ pedido: pedidoId, cliente });

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou este pedido.',
        });
      }

      const doc = await Avaliacao.create({
        pedido: pedidoId,
        cliente,
        nota,
        comentario: texto,
      });

      return res.status(201).json({
        message: 'Avaliação registrada',
        avaliacao: doc,
      });
    }

    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Informe motoristaId | companyId | pedidoId.',
    });
  } catch (err) {
    console.error('Erro ao criar avaliação:', err);
    return res.status(500).json({ error: 'Erro ao criar avaliação' });
  }
};

exports.createAvaliacaoPedidoAlias = async (req, res) => {
  req.body = { ...req.body, pedidoId: req.body.pedidoId };
  return exports.createAvaliacaoGeneric(req, res);
};