// controllers/avaliacaoController.js
const mongoose = require('mongoose');
const Avaliacao = require('../models/Avaliacao');
const Servico = require('../models/Servico');

let Profissional = null;
try {
  Profissional = require('../models/Profissional');
} catch (_) {}

const isObjectId = (v) => {
  if (!v) return false;
  return mongoose.Types.ObjectId.isValid(String(v));
};

const toObjectId = (v) => {
  if (!isObjectId(v)) return null;
  return new mongoose.Types.ObjectId(String(v));
};

const uniqueObjectIds = (values = []) => {
  const map = new Map();

  values.forEach((value) => {
    const obj = toObjectId(value);
    if (obj) {
      map.set(String(obj), obj);
    }
  });

  return [...map.values()];
};

exports.getAvaliacoesPorMotorista = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      return res.status(400).json({ error: 'ID de motorista inválido.' });
    }

    const items = await Avaliacao.find({ motorista: toObjectId(id) })
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

    const idObj = toObjectId(id);
    const idsParaBuscar = [idObj];

    if (Profissional) {
      const prof = await Profissional.findOne({
        $or: [
          { _id: idObj },
          { userId: idObj },
          { userId: String(idObj) },
        ],
      }).lean();

      if (prof?._id) idsParaBuscar.push(prof._id);
      if (prof?.userId) idsParaBuscar.push(prof.userId);
    }

    const idsObjUnicos = uniqueObjectIds(idsParaBuscar);

    console.log('🔎 BUSCANDO AVALIAÇÕES DO PROFISSIONAL:', {
      id,
      ids: idsObjUnicos.map(String),
    });

    /**
     * IMPORTANTE:
     * Não usar $in aqui.
     * Em alguns ambientes/configurações do Mongoose, o $in está sendo tratado
     * como objeto comum e causa CastError em ObjectId.
     */
    const queryOr = [];

    idsObjUnicos.forEach((objId) => {
      queryOr.push({ profissionalId: objId });
      queryOr.push({ profissionalUserId: objId });
    });

    const items = await Avaliacao.find({ $or: queryOr })
      .populate('clienteId', 'name nome email')
      .sort({ createdAt: -1 })
      .lean();

    console.log('⭐ AVALIAÇÕES ENCONTRADAS:', items.length);

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
  profissionalId: profissionalIdBody,
  profissionalUserId: profissionalUserIdBody,

} = req.body || {};

    const notaInput = Number(estrelas ?? rating ?? notaBody);

    if (!Number.isFinite(notaInput) || notaInput < 1 || notaInput > 5) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Nota deve ser um número entre 1 e 5.',
      });
    }

    const nota = Math.round(notaInput);
    const texto = String(comentario ?? comment ?? '').trim();

    const cliente =
      clienteId && isObjectId(clienteId)
        ? toObjectId(clienteId)
        : toObjectId(authUserId);

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

      const motoristaObj = toObjectId(id);

      const filtroDuplicidade = {
        clienteId: cliente,
      };

      if (pedidoId && isObjectId(pedidoId)) {
        filtroDuplicidade.pedido = toObjectId(pedidoId);
      } else {
        filtroDuplicidade.motorista = motoristaObj;
      }

      const existe = await Avaliacao.findOne(filtroDuplicidade).lean();

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou este serviço.',
        });
      }

      let servico = null;

      if (pedidoId && isObjectId(pedidoId)) {
        servico = await Servico.findById(toObjectId(pedidoId)).lean();
      }

      const profissionalIdRaw =
  profissionalIdBody ||
  servico?.profissional?.id ||
  servico?.profissional?._id ||
  servico?.profissionalId ||
  servico?.prestadorId ||
  null;

const profissionalUserIdRaw =
  profissionalUserIdBody ||
  servico?.profissional?.userId ||
  servico?.profissional?.user?._id ||
  servico?.profissional?.user?.id ||
  servico?.profissionalUserId ||
  null;

      const profissionalId = toObjectId(profissionalIdRaw);
      const profissionalUserId = toObjectId(profissionalUserIdRaw);

      console.log('⭐ VINCULANDO AVALIAÇÃO:', {
        pedidoId,
        motoristaId: String(motoristaObj),
        profissionalId: profissionalId ? String(profissionalId) : null,
        profissionalUserId: profissionalUserId ? String(profissionalUserId) : null,
      });

      const payload = {
        motorista: motoristaObj,
        clienteId: cliente,
        nota,
        comentario: texto,
        origem: servico ? 'servico' : 'motorista',
      };

      if (pedidoId && isObjectId(pedidoId)) {
        payload.pedido = toObjectId(pedidoId);
      }

      if (profissionalId) {
        payload.profissionalId = profissionalId;
      }

      if (profissionalUserId) {
        payload.profissionalUserId = profissionalUserId;
      }

      const doc = await Avaliacao.create(payload);

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

      const companyObj = toObjectId(companyId);

      const filtroDuplicidade = {
        empresa: companyObj,
        clienteId: cliente,
      };

      if (productId && isObjectId(productId)) {
        filtroDuplicidade.produto = toObjectId(productId);
      }

      const existe = await Avaliacao.findOne(filtroDuplicidade).lean();

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou esta empresa/produto.',
        });
      }

      const doc = await Avaliacao.create({
        empresa: companyObj,
        produto:
          productId && isObjectId(productId)
            ? toObjectId(productId)
            : undefined,
        clienteId: cliente,
        nota,
        comentario: texto,
        origem: 'empresa',
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

      const pedidoObj = toObjectId(pedidoId);

      const existe = await Avaliacao.findOne({
        pedido: pedidoObj,
        clienteId: cliente,
      }).lean();

      if (existe) {
        return res.status(409).json({
          code: 'ALREADY_RATED',
          message: 'Você já avaliou este pedido.',
        });
      }

      const servico = await Servico.findById(pedidoObj).lean();

      const profissionalIdRaw =
        servico?.profissional?.id ||
        servico?.profissional?._id ||
        servico?.profissionalId ||
        servico?.prestadorId ||
        null;

      const profissionalUserIdRaw =
        servico?.profissional?.userId ||
        servico?.profissionalUserId ||
        null;

      const profissionalId = toObjectId(profissionalIdRaw);
      const profissionalUserId = toObjectId(profissionalUserIdRaw);

      const payload = {
        pedido: pedidoObj,
        clienteId: cliente,
        nota,
        comentario: texto,
        origem: servico ? 'servico' : 'pedido',
      };

      if (profissionalId) {
        payload.profissionalId = profissionalId;
      }

      if (profissionalUserId) {
        payload.profissionalUserId = profissionalUserId;
      }

      const doc = await Avaliacao.create(payload);

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