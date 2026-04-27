// controllers/avaliacaoController.js
const mongoose = require('mongoose');
const Avaliacao = require('../models/Avaliacao');
const Servico = require('../models/Servico');

let Profissional = null;
try {
  Profissional = require('../models/Profissional');
} catch (_) {}

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

exports.getAvaliacoesPorMotorista = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json({ error: 'ID de motorista inválido.' });
    }

    const items = await Avaliacao.find({ motorista: id })
      .populate('clienteId', 'name nome email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error('Erro ao buscar avaliações do motorista:', err);
    return res.status(500).json({ error: 'Erro ao carregar avaliações' });
  }
};

exports.getAvaliacoesPorProfissional = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'ID de profissional inválido.',
      });
    }

    const idObj = new mongoose.Types.ObjectId(id);

    const idsObj = [idObj];
    const idsStr = [String(id)];

    if (Profissional) {
      const prof = await Profissional.findOne({
        $or: [
          { _id: idObj },
          { userId: idObj },
          { userId: String(id) },
        ],
      }).lean();

      if (prof?._id) {
        idsObj.push(prof._id);
        idsStr.push(String(prof._id));
      }

      if (prof?.userId) {
        idsObj.push(prof.userId);
        idsStr.push(String(prof.userId));
      }
    }

    const servicos = await Servico.find({
      $or: [
        { profissional: { $in: idsObj } },
        { profissional: { $in: idsStr } },
        { profissionalId: { $in: idsObj } },
        { profissionalId: { $in: idsStr } },
        { prestador: { $in: idsObj } },
        { prestador: { $in: idsStr } },
        { prestadorId: { $in: idsObj } },
        { prestadorId: { $in: idsStr } },
        { 'profissional.id': { $in: idsStr } },
        { 'profissional._id': { $in: idsStr } },
        { 'profissional.userId': { $in: idsStr } },
      ],
    })
      .select('_id descricao categoria profissional profissionalId prestador prestadorId createdAt')
      .lean();

    const servicoIds = servicos.map((s) => s._id);

    const items = await Avaliacao.find({
      pedido: { $in: servicoIds },
    })
      .populate('clienteId', 'name nome email')
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
      message: err?.message || 'Erro ao carregar avaliações do profissional.',
    });
  }
};

exports.createAvaliacaoGeneric = async (req, res) => {
  try {
    const authUserId = req.userId || req.user?._id || req.user?.id || null;

    const {
      motoristaId,
      motorista,
      companyId,
      pedidoId,
      productId,
      estrelas,
      rating,
      nota: notaBody,
      comentario,
      comment,
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

    const cliente =
      clienteId && isObjectId(clienteId)
        ? clienteId
        : authUserId;

    if (!cliente || !isObjectId(cliente)) {
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

      const existe = await Avaliacao.findOne({
        motorista: id,
        clienteId: cliente,
      });

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou este motorista.',
        });
      }

      const servico = await Servico.findById(pedidoId).lean();

const profissionalId =
  servico?.profissional?.id ||
  servico?.profissional?._id ||
  servico?.profissionalId ||
  servico?.prestadorId ||
  null;

const profissionalUserId =
  servico?.profissional?.userId ||
  servico?.profissionalUserId ||
  null;

console.log('⭐ VINCULANDO AVALIAÇÃO:', {
  pedidoId,
  profissionalId,
  profissionalUserId,
});

const doc = await Avaliacao.create({
  pedido: pedidoId,

  // 🔥 ESSA É A CORREÇÃO PRINCIPAL
  profissionalId: profissionalId && isObjectId(profissionalId)
    ? profissionalId
    : undefined,

  profissionalUserId: profissionalUserId && isObjectId(profissionalUserId)
    ? profissionalUserId
    : undefined,

  prestadorId: profissionalId,

  clienteId: cliente,
  nota,
  comentario: texto,

  origem: 'servico',
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

      const filtroDuplicidade = {
        empresa: companyId,
        clienteId: cliente,
      };

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
        clienteId: cliente,
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

      const existe = await Avaliacao.findOne({
        pedido: pedidoId,
        clienteId: cliente,
      });

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou este pedido.',
        });
      }

      const doc = await Avaliacao.create({
        pedido: pedidoId,
        clienteId: cliente,
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

    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: err?.message || 'Erro ao criar avaliação.',
    });
  }
};

exports.createAvaliacaoPedidoAlias = async (req, res) => {
  req.body = {
    ...req.body,
    pedidoId: req.body.pedidoId,
  };

  return exports.createAvaliacaoGeneric(req, res);
};