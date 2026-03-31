// controllers/solicitacoesController.js
'use strict';

const tryRequire = (paths) => {
  for (const p of paths) {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(p);
    } catch (e) {
      // continue
    }
  }
  return null;
};

const SolicitationModel = tryRequire([
  '../models/solicitacao',
  '../models/solicitacoes',
  '../models/Solicitacao',
  '../models/Solicitacoes',
  '../models/solicitation',
  '../models/requests',
]);

exports.listByProfissional = async (req, res) => {
  try {
    const profissionalId = req.params.id || req.query.profissionalId || req.body.profissionalId;
    if (!profissionalId) return res.status(400).json({ ok: false, message: 'profissionalId ausente' });

    if (!SolicitationModel) {
      // Nenhum model disponível: retornar array vazio para compatibilidade com o cliente
      return res.json([]);
    }

    const filtro = { profissional: profissionalId };
    if (req.query.status) filtro.status = req.query.status;

    const items = await SolicitationModel.find(filtro).sort({ createdAt: -1 }).lean();
    const normalized = (items || []).map(i => ({
      ...i,
      id: i._id?.toString ? i._id.toString() : i.id,
    }));

    return res.json(normalized);
  } catch (err) {
    console.error('solicitacoes.listByProfissional ERROR', {
      params: req.params, query: req.query, message: err.message, stack: err.stack,
    });
    return res.status(500).json({ ok: false, message: 'Erro ao listar solicitações', details: err.message });
  }
};
