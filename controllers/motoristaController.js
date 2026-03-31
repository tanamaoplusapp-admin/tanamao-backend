// controllers/motoristaController.js
const Motorista = require('../models/Motorista');
const Entrega   = require('../models/Entrega');

/* ============================================================================
 * HELPERS
 * ==========================================================================*/
const getUserId = (req) =>
  (req.user?._id || req.userId || req.user?.id || '').toString();

const pick = (obj = {}, allowed = []) =>
  allowed.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

const statusFromIndex = (idx) => {
  switch (Number(idx)) {
    case 0: return 'Pendente';
    case 1: return 'Aceito';
    case 2: return 'Aguardando Coleta';
    case 3: return 'Em Rota';
    case 4: return 'Saiu para Entrega';
    case 5: return 'Entregue';
    default: return 'Desconhecido';
  }
};

const resolveMotoristaDoc = async (userId) => {
  if (!userId) return null;
  let doc = await Motorista.findById(userId);
  if (doc) return doc;
  doc = await Motorista.findOne({ userId });
  return doc;
};
/* ============================================================================
 * 🔒 GATE DE APROVAÇÃO DO MOTORISTA (NOVO – NÃO QUEBRA NADA)
 * ==========================================================================*/
const ensureMotoristaAprovado = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return { ok: false, response: res.status(401).json({ message: 'Não autenticado' }) };
  }

  const motorista = await Motorista.findOne({
    $or: [{ _id: userId }, { userId }],
  }).lean();

  if (!motorista) {
    return {
      ok: false,
      response: res.status(404).json({ message: 'Motorista não encontrado' }),
    };
  }

  if (!motorista.aprovado) {
    return {
      ok: false,
      response: res.status(403).json({
        message: 'Cadastro em análise. Aguarde aprovação.',
        statusCadastro: motorista.statusCadastro || 'pendente',
      }),
    };
  }

  return { ok: true, motorista };
};

/* ============================================================================
 * CRUD ORIGINAIS
 * ==========================================================================*/
const getMotoristas = async (_req, res) => {
  try {
    const motoristas = await Motorista.find().lean();
    res.status(200).json(motoristas);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar motoristas', error: error?.message || error });
  }
};

const getMotoristaById = async (req, res) => {
  try {
    const motorista = await Motorista.findById(req.params.id).lean();
    if (!motorista) return res.status(404).json({ message: 'Motorista não encontrado' });
    res.status(200).json(motorista);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar motorista', error: error?.message || error });
  }
};

const createMotorista = async (req, res) => {
  try {
    const allow = ['nome', 'email', 'telefone', 'cpf', 'cnh',
      'placa', 'modelo', 'fotoPerfil', 'aprovado', 'status'];
    const data = pick(req.body, allow);

    const dup = await Motorista.findOne({
      $or: [
        data.email ? { email: data.email } : null,
        data.cpf   ? { cpf: data.cpf }     : null,
        data.cnh   ? { cnh: data.cnh }     : null,
      ].filter(Boolean)
    }).lean();

    if (dup) {
      return res.status(409).json({ message: 'Já existe motorista com estes dados (email/CPF/CNH).' });
    }

    const novoMotorista = new Motorista(data);
    const savedMotorista = await novoMotorista.save();
    res.status(201).json(savedMotorista);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao criar motorista', error: error?.message || error });
  }
};

const updateMotorista = async (req, res) => {
  try {
    const allow = ['nome', 'email', 'telefone', 'cpf', 'cnh',
      'placa', 'modelo', 'fotoPerfil', 'aprovado', 'status'];
    const data = pick(req.body, allow);

    const motoristaAtualizado = await Motorista.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true }
    );
    if (!motoristaAtualizado) {
      return res.status(404).json({ message: 'Motorista não encontrado' });
    }
    res.status(200).json(motoristaAtualizado);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao atualizar motorista', error: error?.message || error });
  }
};

const deleteMotorista = async (req, res) => {
  try {
    const motorista = await Motorista.findByIdAndDelete(req.params.id);
    if (!motorista) {
      return res.status(404).json({ message: 'Motorista não encontrado' });
    }
    res.status(200).json({ message: 'Motorista deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar motorista', error: error?.message || error });
  }
};

const aprovarMotorista = async (req, res) => {
  try {
    const motorista = await Motorista.findByIdAndUpdate(
      req.params.id,
      { $set: { aprovado: true, status: 'aprovado' } },
      { new: true }
    );
    if (!motorista) {
      return res.status(404).json({ message: 'Motorista não encontrado' });
    }
    res.status(200).json({ message: 'Motorista aprovado com sucesso', motorista });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao aprovar motorista', error: error?.message || error });
  }
};

const getHistoricoEntregas = async (req, res) => {
  try {
    const motoristaId = getUserId(req);
    const entregas = await Entrega.find({ motoristaId, statusIndex: 5 })
      .sort({ criadoEm: -1, createdAt: -1 })
      .lean();
    res.status(200).json(entregas);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico de entregas' });
  }
};

/* ============================================================================
 * FUNÇÕES PARA O APP
 * ==========================================================================*/
const validarCNH = async (req, res) => {
  try {
    const { cnh } = req.body || {};
    if (!cnh) return res.status(422).json({ message: 'CNH é obrigatória.' });

    if (process.env.MOCK_CNH === '1' || process.env.NODE_ENV !== 'production') {
      const ultima = Number(String(cnh).slice(-1));
      const ativa = !Number.isNaN(ultima) && (ultima % 2 === 0);
      return res.json({
        valida: ativa,
        situacao: ativa ? 'ATIVA' : 'SUSPENSA',
        mensagem: ativa ? 'CNH apta (mock)' : 'CNH em suspensão (mock)',
      });
    }

    return res.status(503).json({ message: 'Validação de CNH indisponível no momento.' });
  } catch (err) {
    console.error('[validarCNH]', err);
    return res.status(502).json({ message: 'Falha ao validar CNH.' });
  }
};

const atualizarDocumentosMotorista = async (req, res) => {
  try {
    const userId = getUserId(req);
    const allow = ['cnh', 'placa', 'modelo', 'fotos', 'statusCadastro'];
    const data = pick(req.body, allow);

    if (data.placa) data.placa = String(data.placa).toUpperCase();

    let doc = await resolveMotoristaDoc(userId);

    if (!doc) {
      doc = await Motorista.create({ _id: userId, userId, ...data });
    } else {
      await Motorista.updateOne({ _id: doc._id }, { $set: data }, { upsert: true });
      doc = await Motorista.findById(doc._id);
    }

    return res.json({ ok: true, motorista: doc });
  } catch (e) {
    console.error('[atualizarDocumentosMotorista]', e);
    return res.status(500).json({ message: 'Erro ao salvar documentos.' });
  }
};

const getPerfilMotorista = async (req, res) => {
  try {
    const userId = getUserId(req);
    const doc = await resolveMotoristaDoc(userId);
    if (!doc) {
      return res.json({
        nome: null, email: null, telefone: null, cnh: null,
        placa: null, veiculo: null, fotoPerfil: null,
      });
    }
    const raw = doc.toObject ? doc.toObject() : doc;
    const perfil = pick(raw, [
      'nome', 'email', 'telefone', 'cnh', 'placa', 'veiculo', 'fotoPerfil'
    ]);
    return res.json(perfil);
  } catch (e) {
    console.error('[getPerfilMotorista]', e);
    return res.status(500).json({ message: 'Erro ao buscar perfil.' });
  }
};

const atualizarPerfilMotorista = async (req, res) => {
  try {
    const userId = getUserId(req);
    const allow = ['nome', 'email', 'telefone', 'cnh', 'placa', 'veiculo', 'fotoPerfil'];
    const data = pick(req.body, allow);
    if (data.placa) data.placa = String(data.placa).toUpperCase();

    let doc = await resolveMotoristaDoc(userId);
    if (!doc) {
      doc = await Motorista.create({ _id: userId, userId, ...data });
    } else {
      await Motorista.updateOne({ _id: doc._id }, { $set: data }, { upsert: true });
      doc = await Motorista.findById(doc._id);
    }

    return res.json({ ok: true, motorista: doc });
  } catch (e) {
    console.error('[atualizarPerfilMotorista]', e);
    return res.status(500).json({ message: 'Erro ao atualizar perfil.' });
  }
};

const getResumoMotorista = async (req, res) => {
  try {
    const motoristaId = getUserId(req);

    const grupos = await Entrega.aggregate([
      { $match: { motoristaId } },
      { $group: { _id: { status: '$status', statusIndex: '$statusIndex' }, total: { $sum: 1 } } }
    ]);

    const countBy = { concluidas: 0, emRota: 0, pendentes: 0 };
    let totalTodas = 0;

    grupos.forEach(g => {
      const s = g._id?.status;
      const si = g._id?.statusIndex;
      const t = g.total || 0;
      totalTodas += t;

      if (s === 'Entregue' || si === 5) { countBy.concluidas += t; return; }
      if (s === 'Em Rota' || s === 'Saiu para Entrega' || si === 3 || si === 4) {
        countBy.emRota += t; return;
      }
      countBy.pendentes += t;
    });

    return res.json({
      pendentes: countBy.pendentes,
      emRota: countBy.emRota,
      concluidas: countBy.concluidas,
      naoLidas: 0,
      total: totalTodas
    });
  } catch (e) {
    console.error('[getResumoMotorista]', e);
    return res.status(500).json({ message: 'Erro ao buscar resumo.' });
  }
};


  const getPedidosMotorista = async (req, res) => {
  try {
    const gate = await ensureMotoristaAprovado(req, res);
    if (!gate.ok) return gate.response;

    const motoristaId = getUserId(req);
    const { tipo } = req.query;

    let filtro;
    if (tipo === 'disponiveis') {
      filtro = {
        $and: [
          { $or: [{ motoristaId: null }, { motoristaId: { $exists: false } }] },
          { $or: [{ status: { $ne: 'Entregue' } }, { statusIndex: { $ne: 5 } }] }
        ]
      };
    } else {
      filtro = { motoristaId };
    }

    const docs = await Entrega.find(filtro)
      .sort({ criadoEm: -1, createdAt: -1 })
      .limit(200)
      .lean();

    const items = docs.map((e) => {
      const rawStatus = e.status || statusFromIndex(e.statusIndex);
      const status = String(rawStatus || '').toLowerCase();

      const enderecoEntrega =
        e.enderecoEntrega || e.endereco || (e.destino && e.destino.endereco) || null;

      const nomeEmpresa =
        e.empresaNome || (e.empresa && (e.empresa.nome || e.empresa.nomeFantasia)) || null;

      const nomeCliente =
        e.clienteNome || (e.cliente && (e.cliente.nome || e.cliente.name)) || null;

      const dt = e.criadoEm || e.createdAt || new Date();
      let hora = null;
      try {
        const d = new Date(dt);
        hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch {}

      return {
        _id: e._id,
        status,
        enderecoEntrega,
        nomeEmpresa,
        nomeCliente,
        hora,
        precoEntrega: Number(e.precoEntrega || 0),
        avaliacaoMotorista: e.avaliacaoMotorista ?? null,
      };
    });

    return res.json(items);
  } catch (e) {
    console.error('[getPedidosMotorista]', e);
    return res.status(500).json({ message: 'Erro ao buscar pedidos.' });
  }
};

/* ============================================================================
 * EXPORTS
 * ==========================================================================*/
module.exports = {
  getMotoristas,
  getMotoristaById,
  createMotorista,
  updateMotorista,
  deleteMotorista,
  aprovarMotorista,
  getHistoricoEntregas,
  validarCNH,
  atualizarDocumentosMotorista,
  getPerfilMotorista,
  atualizarPerfilMotorista,
  getResumoMotorista,
  getPedidosMotorista,
};
