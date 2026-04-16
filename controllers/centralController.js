// controllers/centralController.js
const User = require('../models/user');
const Company = require('../models/company');
const Servico = require('../models/Servico');
const Chat = require('../models/Chat');
const Avaliacao = require('../models/Avaliacao');
const Profissional = require('../models/Profissional');
const Mensagem = require('../models/Mensagem');

/* ============================================================================
 * HELPERS
 * ========================================================================== */
const pick = (obj = {}, allowed = []) =>
  allowed.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

const getPagination = (query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 500);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = (date = new Date()) => {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
};

const startOfMonth = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isValidDate = (value) => {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
};

const toDate = (value) => {
  if (!isValidDate(value)) return null;
  return new Date(value);
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const regexFromQuery = (q = '') => new RegExp(q.trim(), 'i');

const isActiveUser = (user = {}) =>
  user.active === true ||
  user.status === 'active' ||
  user.status === 'ativo';

const isBlockedUser = (user = {}) =>
  user.status === 'blocked' ||
  user.status === 'bloqueado' ||
  user.receberServicos === false;

const isPayingProvider = (user = {}) =>
  ['profissional', 'mensal_comissao'].includes(user.planType) ||
  user.subscriptionStatus === 'active';

const isOverdueProvider = (user = {}) =>
  user.subscriptionStatus === 'overdue' ||
  toNumber(user.comissaoPendente, 0) > 0;

const getUserDisplayStatus = (user = {}) => {
  if (user.status) return user.status;
  if (user.active === true) return 'ativo';
  return 'inativo';
};

const hasBankData = (user = {}) => {
  if (!user.bank) return false;
  if (typeof user.bank !== 'object') return !!user.bank;
  return Object.keys(user.bank).length > 0;
};

const getChatType = (chat = {}) =>
  String(chat.type || chat.tipo || '').toLowerCase();

const getChatStatus = (chat = {}) =>
  String(chat.status || '').toLowerCase();

/* ============================================================================
 * DASHBOARD GERAL DA CENTRAL
 * ========================================================================== */
const getCentralDashboard = async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      users,
      companies,
      servicos,
      chats,
      avaliacoes,
      prestadoresAtivos,
    ] = await Promise.all([
      User.find().lean(),
      Company.find().lean(),
      Servico.find().lean(),
      Chat.find().lean(),
      Avaliacao.find().lean(),
      Profissional.countDocuments({
        $or: [{ aprovado: true }, { status: 'aprovado' }],
      }),
    ]);

    const profissionais = users.filter((u) => u.role === 'profissional');
    const clientes = users.filter((u) => u.role === 'cliente');
    const motoristas = users.filter((u) => u.role === 'motorista');

    const bloqueados = users.filter(isBlockedUser).length;
    const inadimplentes = profissionais.filter(isOverdueProvider).length;

    const assinaturasAtivas = profissionais.filter(
      (u) => u.subscriptionStatus === 'active'
    ).length;

    const prestadoresPagantes = profissionais.filter(isPayingProvider).length;

    const novosHoje = users.filter((u) => {
      const createdAt = toDate(u.createdAt);
      return createdAt && createdAt >= todayStart;
    }).length;

    const novos7dias = users.filter((u) => {
      const createdAt = toDate(u.createdAt);
      return createdAt && createdAt >= sevenDaysAgo;
    }).length;

    let receitaHoje = 0;
    let receitaSemana = 0;
    let receitaMes = 0;
    let receitaTotal = 0;
    let mrr = 0;

    let criados = 0;
    let aceitos = 0;
    let finalizados = 0;
    let cancelados = 0;
    let semResposta = 0;

    const servicosPagos = [];

    for (const s of servicos) {
      criados += 1;

      const createdAt = toDate(s.createdAt);
      const valorPago = toNumber(s.valorPago ?? s.valorFinal ?? s.price, 0);
      const status = String(s.status || 'pendente').toLowerCase();

      receitaTotal += valorPago;
      if (valorPago > 0) servicosPagos.push(s);

      if (createdAt && createdAt >= todayStart) {
        receitaHoje += valorPago;
      }

      if (createdAt && createdAt >= weekStart) {
        receitaSemana += valorPago;
      }

      if (createdAt && createdAt >= monthStart) {
        receitaMes += valorPago;
      }

      if (status === 'aceito') aceitos += 1;
      if (status === 'finalizado') finalizados += 1;
      if (status === 'cancelado') cancelados += 1;

      if (
        status === 'pendente' ||
        status === 'aguardando' ||
        status === 'solicitado' ||
        !s.status
      ) {
        semResposta += 1;
      }
    }

    for (const p of profissionais) {
      if (
        p.subscriptionStatus === 'active' &&
        ['profissional', 'mensal_comissao'].includes(p.planType)
      ) {
        mrr += toNumber(p.subscriptionAmount, 0);
      }
    }

    const ticketMedio =
      servicosPagos.length > 0 ? receitaTotal / servicosPagos.length : 0;

    const taxaResposta =
      criados > 0 ? ((aceitos + finalizados) / criados) * 100 : 0;

    const taxaPagamento =
      profissionais.length > 0
        ? (prestadoresPagantes / profissionais.length) * 100
        : 0;

    // KPIs de chats calculados em memória para evitar CastError no createdAt
const chatsHojeList = chats.filter((c) => {
  const createdAt = toDate(c.createdAt);
  return createdAt && createdAt >= todayStart;
});

const chatsHoje = chatsHojeList.length;

const chatIdsHoje = chatsHojeList
  .map((c) => c?._id)
  .filter(Boolean)
  .map((id) => String(id));

const chatsAbertosSuporte = chats.filter((c) => {
  const type = getChatType(c);
  const status = getChatStatus(c);

  const isSupport =
    type.includes('support') ||
    type.includes('suporte') ||
    c.isSupport === true;

  const isOpen =
    !status ||
    status === 'open' ||
    status === 'aberto' ||
    status === 'pending' ||
    status === 'pendente';

  return isSupport && isOpen;
}).length;

const somaAvaliacoes = avaliacoes.reduce((acc, item) => {
  const value = item.rating ?? item.nota ?? item.score ?? item.stars;
  return acc + toNumber(value, 0);
}, 0);

const ratingMedio =
  avaliacoes.length > 0 ? somaAvaliacoes / avaliacoes.length : 0;

let tempoResposta = 0;
let tempoPrimeiroChat = 0;

let mensagens = [];

if (chatIdsHoje.length > 0) {
  mensagens = await Mensagem.find(
    { chatId: { $in: chatIdsHoje } },
    { chatId: 1, remetente: 1, createdAt: 1, enviadoEm: 1 }
  )
    .sort({ chatId: 1, createdAt: 1, enviadoEm: 1 })
    .lean();
}

const mensagensPorChat = new Map();

for (const msg of mensagens) {
  const key = String(msg.chatId);
  if (!mensagensPorChat.has(key)) {
    mensagensPorChat.set(key, []);
  }
  mensagensPorChat.get(key).push(msg);
}

const tempos = [];

for (const [, msgs] of mensagensPorChat) {
  if (!msgs || msgs.length < 2) continue;

  const primeira = msgs[0];

  const resposta = msgs.find(
    (m) => String(m.remetente) !== String(primeira.remetente)
  );

  if (!resposta) continue;

  const t1 = new Date(primeira.createdAt || primeira.enviadoEm);
  const t2 = new Date(resposta.createdAt || resposta.enviadoEm);

  if (Number.isNaN(t1.getTime()) || Number.isNaN(t2.getTime())) continue;
  if (t2 < t1) continue;

  const diffMin = Math.round((t2 - t1) / 60000);
  tempos.push(diffMin);
}

if (tempos.length > 0) {
  const media = Math.round(
    tempos.reduce((acc, n) => acc + n, 0) / tempos.length
  );
  tempoResposta = media;
  tempoPrimeiroChat = media;
}

    const servicosHoje = servicos.filter((s) => {
      const createdAt = toDate(s.createdAt);
      return createdAt && createdAt >= todayStart;
    }).length;

    const prestadoresSemResposta = profissionais.filter((p) => {
      const totalSolicitacoes = toNumber(
        p.totalSolicitacoesRecebidas ?? p.totalSolicitacoes ?? 0,
        0
      );

      const totalRespondidas = toNumber(
        p.totalSolicitacoesRespondidas ?? p.totalRespondidas ?? 0,
        0
      );

      return totalSolicitacoes > 0 && totalRespondidas === 0;
    }).length;

    return res.json({
      ok: true,
      marketplace: {
        prestadoresAtivos,
        servicosHoje,
        chatsHoje,
        tempoResposta,
      },
      finance: {
        receitaHoje,
        receitaSemana,
        receitaMes,
        receitaTotal,
        mrr,
        ticketMedio,
        assinaturasAtivas,
        inadimplentes,
      },
      users: {
        total: users.length,
        clientes: clientes.length,
        prestadores: profissionais.length,
        motoristas: motoristas.length,
        bloqueados,
        novosHoje,
        novos7dias,
      },
      services: {
        criados,
        aceitos,
        finalizados,
        cancelados,
        semResposta,
        taxaResposta,
      },
      conversion: {
        prestadoresCadastro: profissionais.length,
        prestadoresPagantes,
        taxaPagamento,
        prestadoresAtivos,
      },
      quality: {
        ratingMedio,
        tempoPrimeiroChat,
        prestadoresSemResposta,
      },
      support: {
        abertos: chatsAbertosSuporte,
      },
      extras: {
        empresasTotal: companies.length,
        empresasAtivas: companies.filter((c) => !!c.active).length,
      },
    });
  } catch (e) {
    console.error('central.getCentralDashboard:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao gerar dashboard central',
      error: e.message,
    });
  }
};

/* ============================================================================
 * USUÁRIOS (PROFISSIONAIS, MOTORISTAS, CLIENTES)
 * ========================================================================== */
const listUsersForAdmin = async (role, req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const q = (req.query.q || '').trim();

    const filter = { role };

    if (q) {
      const regex = regexFromQuery(q);
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const enriched = items.map((u) => ({
      _id: u._id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role,
      status: getUserDisplayStatus(u),
      ativo: isActiveUser(u),
      bank: u.bank || null,
      isVerified: !!u.isVerified,
      subscriptionStatus: u.subscriptionStatus || null,
      planType: u.planType || null,
      receberServicos:
        typeof u.receberServicos === 'boolean' ? u.receberServicos : null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return res.json({
      ok: true,
      data: enriched,
      page,
      limit,
      total,
    });
  } catch (e) {
    console.error(`${role}.listForAdmin:`, e);
    return res.status(500).json({
      ok: false,
      message: `Erro ao listar ${role} para admin`,
      error: e.message,
    });
  }
};

const dashboardUsers = async (role, extra = {}, res) => {
  try {
    const users = await User.find({ role }).lean();

    const total = users.length;
    const ativos = users.filter(isActiveUser).length;

    const data = { total, ativos };

    if (extra.bank) {
      data.comBanco = users.filter(hasBankData).length;
    }

    if (extra.isVerified) {
      data.verificados = users.filter((u) => !!u.isVerified).length;
    }

    if (extra.subscription) {
      data.assinaturasAtivas = users.filter(
        (u) => u.subscriptionStatus === 'active'
      ).length;
      data.inadimplentes = users.filter(isOverdueProvider).length;
    }

    return res.json({ ok: true, data });
  } catch (e) {
    console.error(`${role}.dashboard:`, e);
    return res.status(500).json({
      ok: false,
      message: `Erro ao gerar dashboard de ${role}`,
      error: e.message,
    });
  }
};

/* ============================================================================
 * EMPRESAS
 * ========================================================================== */
const listCompaniesForAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const q = (req.query.q || '').trim();

    const filter = {};

    if (q) {
      const regex = regexFromQuery(q);
      filter.$or = [
        { nome: regex },
        { email: regex },
        { cnpj: regex },
        { telefone: regex },
      ];
    }

    const [companies, total] = await Promise.all([
      Company.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(filter),
    ]);

    const enriched = companies.map((c) => ({
      _id: c._id,
      nome: c.nome || '',
      email: c.email || '',
      cnpj: c.cnpj || '',
      telefone: c.telefone || '',
      porteEmpresa: c.porteEmpresa || '',
      ativo: !!c.active,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return res.json({
      ok: true,
      data: enriched,
      page,
      limit,
      total,
    });
  } catch (e) {
    console.error('companies.listForAdmin:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao listar empresas para admin',
      error: e.message,
    });
  }
};

const dashboardCompanies = async (_req, res) => {
  try {
    const companies = await Company.find().lean();

    const total = companies.length;
    const ativos = companies.filter((c) => !!c.active).length;

    return res.json({
      ok: true,
      data: { total, ativos },
    });
  } catch (e) {
    console.error('companies.dashboard:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao gerar dashboard de empresas',
      error: e.message,
    });
  }
};

/* ============================================================================
 * EXPORTS
 * ========================================================================== */
module.exports = {
  getCentralDashboard,

  listProfessionalsForAdmin: (req, res) =>
    listUsersForAdmin('profissional', req, res),
  dashboardProfessionals: (_req, res) =>
    dashboardUsers('profissional', { bank: true, subscription: true }, res),

  listDriversForAdmin: (req, res) =>
    listUsersForAdmin('motorista', req, res),
  dashboardDrivers: (_req, res) =>
    dashboardUsers('motorista', { bank: true }, res),

  listClientsForAdmin: (req, res) =>
    listUsersForAdmin('cliente', req, res),
  dashboardClients: (_req, res) =>
    dashboardUsers('cliente', { isVerified: true }, res),

  listCompaniesForAdmin,
  dashboardCompanies,
  pick,
};