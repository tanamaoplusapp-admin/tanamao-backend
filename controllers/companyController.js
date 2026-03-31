// controllers/companyController.js
let Company;
try { Company = require('../models/company'); } catch (_) {}
if (!Company) { try { Company = require('../models/empresa'); } catch (_) {} }

let Order;
try { Order = require('../models/order'); } catch (_) {}

let Chat;
try { Chat = require('../models/Chat'); } catch (_) {}

let assessPorteEmpresa;
try { ({ assessPorteEmpresa } = require('../utils/porteEmpresa')); } catch (_) {}
let ONLY_DIGITS;
try { ({ ONLY_DIGITS } = require('../utils/validators')); } catch (_) {}

// --- Fallbacks leves (caso utils não existam) ---
if (!ONLY_DIGITS) {
  ONLY_DIGITS = (v = '') => String(v).replace(/\D+/g, '');
}
if (!assessPorteEmpresa) {
  // Regra simples: se não vier declarado, decide por faturamento
  assessPorteEmpresa = ({ declaradoPorte, faturamentoAnual = 0 }) => {
    const map = { mei: 'mei', micro: 'pequena', pequena: 'pequena', media: 'media', média: 'media', grande: 'grande' };
    let original = (declaradoPorte || '').toString().trim().toLowerCase();
    let normalizado = map[original];
    if (!normalizado) {
      if (faturamentoAnual <= 81_000) normalizado = 'mei';
      else if (faturamentoAnual <= 4_800_000) normalizado = 'pequena';
      else if (faturamentoAnual <= 300_000_000) normalizado = 'media';
      else normalizado = 'grande';
    }
    return { original: original || null, normalizado };
  };
}

// ----------------- helpers -----------------
async function resolveCompanyForUser(user) {
  if (!user || !Company) return null;
  let company =
    (await Company.findOne({ user: user._id })) ||
    (await Company.findOne({ owner: user._id }));
  if (company) return company;

  if (user.email) {
    company = await Company.findOne({ email: user.email });
    if (company) return company;
  }
  if (user.companyId) {
    company = await Company.findById(user.companyId);
  }
  return company;
}

// ----------------- controllers -----------------

/** POST /api/companies/validate  -> usado no RegisterEmpresaStep1 */
exports.validateCompany = async (req, res) => {
  try {
    if (!Company) return res.status(500).json({ error: 'Model Company não disponível' });

    const { nome, email, cnpj, telefone, porte } = req.body || {};
    if (!nome || !email || !cnpj || !telefone || !porte) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const doc = ONLY_DIGITS(cnpj);
    const exists = await Company.findOne({
      $or: [{ email: email.toLowerCase() }, { cnpj: doc }],
    }).select('_id email cnpj');

    if (exists) {
      return res.status(409).json({ error: 'Empresa já cadastrada (email ou CNPJ)' });
    }

    const aval = assessPorteEmpresa({ declaradoPorte: porte });
    return res.json({
      ok: true,
      porteNormalizado: aval.normalizado,
      message: 'Validação OK',
    });
  } catch (e) {
    console.error('validateCompany:', e);
    res.status(500).json({ error: e.message || 'Erro ao validar empresa' });
  }
};

/** POST /api/companies/register (compat) */
exports.registerCompany = async (req, res) => {
  try {
    if (!Company) return res.status(500).json({ message: 'Model Company não disponível' });

    const body = { ...(req.body || {}) };

    if (body.cnpj || body.cpf) {
      const doc = ONLY_DIGITS(body.cnpj || body.cpf);
      body.cnpj = doc.length === 14 ? doc : undefined;
      body.cpf  = doc.length === 11 ? doc : undefined;
    }

    const aval = assessPorteEmpresa({
      declaradoPorte: body.porteEmpresa,
      faturamentoAnual: body.faturamentoAnual,
      capitalSocial: body.capitalSocial,
      cidade: body.cidade,
      uf: body.uf,
    });

    body.porteOriginal = aval.original;
    body.porteEmpresa  = aval.normalizado;

    const company = await Company.create(body);
    res.status(201).json({ message: 'Empresa registrada com sucesso', company });
  } catch (error) {
    console.error('registerCompany:', error);
    res.status(400).json({ message: 'Erro ao registrar empresa', error: error.message || error });
  }
};

/** GET /api/companies/me */
exports.getMyCompany = async (req, res) => {
  try {
    const company = await resolveCompanyForUser(req.user);
    if (!company) return res.status(404).json({ message: 'Empresa não encontrada para o usuário' });
    res.json(company);
  } catch (error) {
    console.error('getMyCompany:', error);
    res.status(500).json({ message: 'Erro ao obter empresa', error: error.message || error });
  }
};

/** PUT /api/companies/me */
exports.updateMyCompany = async (req, res) => {
  try {
    const company = await resolveCompanyForUser(req.user);
    if (!company) return res.status(404).json({ message: 'Empresa não encontrada para o usuário' });

    const body = { ...(req.body || {}) };

    if (body.cnpj || body.cpf) {
      const doc = ONLY_DIGITS(body.cnpj || body.cpf);
      body.cnpj = doc.length === 14 ? doc : undefined;
      body.cpf  = doc.length === 11 ? doc : undefined;
    }

    const recalcular = ['porteEmpresa','faturamentoAnual','capitalSocial','cidade','uf']
      .some((k) => Object.prototype.hasOwnProperty.call(body, k));

    if (recalcular) {
      const aval = assessPorteEmpresa({
        declaradoPorte: body.porteEmpresa ?? company.porteOriginal,
        faturamentoAnual: body.faturamentoAnual ?? company.faturamentoAnual,
        capitalSocial: body.capitalSocial ?? company.capitalSocial,
        cidade: body.cidade ?? company.cidade,
        uf: body.uf ?? company.uf,
      });
      body.porteOriginal = aval.original;
      body.porteEmpresa  = aval.normalizado;
    }

    Object.assign(company, body);
    await company.save();
    res.json({ message: 'Empresa atualizada', company });
  } catch (error) {
    console.error('updateMyCompany:', error);
    res.status(400).json({ message: 'Erro ao atualizar empresa', error: error.message || error });
  }
};

/** GET /api/companies/me/overview */
exports.getEmpresaOverview = async (req, res) => {
  try {
    const company = await resolveCompanyForUser(req.user);
    if (!company) return res.status(404).json({ message: 'Empresa não encontrada para o usuário' });
    if (!Order) return res.json({ empresa: { _id: company._id, nome: company.nome }, pedidosPendentes: 0, pedidosAndamento: 0, pedidosFinalizados: 0, faturamentoHoje: 0 });

    const empresaId = company._id;

    const [pendentes, andamento, finalizados] = await Promise.all([
      Order.countDocuments({ empresaId, deliveryStatus: { $in: ['aguardando', 'preparando'] } }),
      Order.countDocuments({ empresaId, deliveryStatus: 'em_rota' }), // importante: underscore
      Order.countDocuments({ empresaId, deliveryStatus: 'entregue' }),
    ]);

    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);

    let faturamentoHoje = 0;
    try {
      const pagosHoje = await Order.aggregate([
        { $match: { empresaId, createdAt: { $gte: start, $lte: end }, 'pagamento.status': 'approved' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]);
      faturamentoHoje = pagosHoje?.[0]?.total || 0;
    } catch (_) {}

    res.json({
      empresa: { _id: company._id, nome: company.nome },
      pedidosPendentes: pendentes,
      pedidosAndamento: andamento,
      pedidosFinalizados: finalizados,
      faturamentoHoje,
    });
  } catch (error) {
    console.error('getEmpresaOverview:', error);
    res.status(500).json({ message: 'Erro ao carregar overview', error: error.message || error });
  }
};

/** GET /api/companies/reviews/recent */
exports.getRecentReviews = async (_req, res) => {
  try {
    res.json([]); // placeholder; integre seu model de reviews aqui
  } catch (error) {
    res.status(500).json({ message: 'Erro ao obter avaliações', error: error.message || error });
  }
};

/** GET /api/companies/chats/recent */
exports.getRecentChats = async (req, res) => {
  try {
    if (!Chat) return res.json([]);
    const userId = req.user?._id || req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: 'Usuário não autenticado' });

    const chats = await Chat.find({ participantes: userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('participantes', 'name role')
      .lean();

    const shaped = (chats || []).map((c) => {
      const other = (c.participantes || []).find((p) => String(p._id) !== String(userId));
      const nome = other?.name || 'Contato';
      const tipo = other?.role === 'driver' ? 'motorista' : (other?.role === 'customer' ? 'cliente' : 'contato');
      const ultimaMsg = (c.mensagens && c.mensagens.length > 0)
        ? (c.mensagens[c.mensagens.length - 1].conteudo || '')
        : '';
      return { id: c._id, nome, tipo, ultimaMsg };
    });

    res.json(shaped);
  } catch (error) {
    console.error('getRecentChats:', error);
    res.status(500).json({ message: 'Erro ao obter chats', error: error.message || error });
  }
};

/** GET /api/companies/nearby?lat=..&lng=..&radiusKm=500 */
exports.getNearby = async (req, res) => {
  try {
    if (!Company) return res.status(500).json({ message: 'Model Company não disponível' });

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(Number(req.query.radiusKm) || 500, 500);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const fallback = await Company.find().select('nome categoria imagens location').limit(20);
      return res.json({ empresas: fallback, total: fallback.length, fallback: true });
    }

    try {
      const empresas = await Company.find({
        location: { $geoWithin: { $centerSphere: [[lng, lat], radiusKm / 6371] } },
      }).select('nome categoria imagens location');
      return res.json({ empresas, total: empresas.length, fallback: false });
    } catch (_geoErr) {
      const all = await Company.find().select('nome categoria imagens location');
      const haversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI/180;
        const dLon = (lon2 - lon1) * Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
      };
      const empresas = (all || []).filter((e) => {
        const coords = e.location && e.location.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return false;
        const [elng, elat] = coords; // [lng, lat]
        const dist = haversine(lat, lng, elat, elng);
        return dist <= radiusKm;
      });
      return res.json({ empresas, total: empresas.length, fallback: true });
    }
  } catch (error) {
    console.error('getNearby:', error);
    res.status(500).json({ message: 'Erro ao buscar empresas próximas', error: error.message || error });
  }
};

/** GET /api/companies/porte/assess */
exports.assessCompanyPorte = async (req, res) => {
  try {
    const params = {
      declaradoPorte: req.query.porteEmpresa ?? req.body?.porteEmpresa,
      faturamentoAnual: Number(req.query.faturamentoAnual ?? req.body?.faturamentoAnual ?? 0),
      capitalSocial: Number(req.query.capitalSocial ?? req.body?.capitalSocial ?? 0),
      cidade: req.query.cidade ?? req.body?.cidade ?? '',
      uf: req.query.uf ?? req.body?.uf ?? '',
    };
    const aval = assessPorteEmpresa(params);
    res.json(aval);
  } catch (error) {
    console.error('assessCompanyPorte:', error);
    res.status(500).json({ message: 'Erro ao avaliar porte', error: error.message || error });
  }
};
