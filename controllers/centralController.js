// controllers/centralController.js
const User = require('../models/user');
const Company = require('../models/company');

/* ============================================================================ 
 * HELPERS
 * ========================================================================== */
const pick = (obj = {}, allowed = []) =>
  allowed.reduce((acc, k) => (obj[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {});

const getPagination = (query) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 500);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/* ============================================================================ 
 * USUÁRIOS (PROFISSIONAIS, MOTORISTAS, CLIENTES)
 * ========================================================================== */
const listUsersForAdmin = async (role, req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const q = (req.query.q || '').trim();

    const filter = { role };
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];

    const [items, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    const enriched = items.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status || 'ativo',
      ativo: !!u.active,
      bank: u.bank || null,
      isVerified: !!u.isVerified,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));

    return res.json({ ok: true, data: enriched, page, limit, total });
  } catch (e) {
    console.error(`${role}.listForAdmin:`, e);
    return res.status(500).json({ ok: false, message: `Erro ao listar ${role} para admin` });
  }
};

const dashboardUsers = async (role, extra = {}, res) => {
  try {
    const total = await User.countDocuments({ role });
    const ativos = await User.countDocuments({ role, active: true });
    const data = { total, ativos };

    if (extra.bank) data.comBanco = await User.countDocuments({ role, bank: { $exists: true } });
    if (extra.isVerified) data.verificados = await User.countDocuments({ role, isVerified: true });

    return res.json({ ok: true, data });
  } catch (e) {
    console.error(`${role}.dashboard:`, e);
    return res.status(500).json({ ok: false, message: `Erro ao gerar dashboard de ${role}` });
  }
};

/* ============================================================================ 
 * EMPRESAS
 * ========================================================================== */
const listCompaniesForAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [companies, total] = await Promise.all([
      Company.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Company.countDocuments()
    ]);

    const enriched = companies.map(c => ({
      _id: c._id,
      nome: c.nome,
      email: c.email,
      cnpj: c.cnpj,
      telefone: c.telefone,
      porteEmpresa: c.porteEmpresa,
      ativo: !!c.active,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    return res.json({ ok: true, data: enriched, page, limit, total });
  } catch (e) {
    console.error('companies.listForAdmin:', e);
    return res.status(500).json({ ok: false, message: 'Erro ao listar empresas para admin' });
  }
};

const dashboardCompanies = async (_req, res) => {
  try {
    const total = await Company.countDocuments();
    const ativos = await Company.countDocuments({ active: true });
    return res.json({ ok: true, data: { total, ativos } });
  } catch (e) {
    console.error('companies.dashboard:', e);
    return res.status(500).json({ ok: false, message: 'Erro ao gerar dashboard de empresas' });
  }
};

/* ============================================================================ 
 * EXPORTS
 * ========================================================================== */
module.exports = {
  // Profissionais
  listProfessionalsForAdmin: (req, res) => listUsersForAdmin('profissional', req, res),
  dashboardProfessionals: (_req, res) => dashboardUsers('profissional', { bank: true }, res),

  // Motoristas
  listDriversForAdmin: (req, res) => listUsersForAdmin('motorista', req, res),
  dashboardDrivers: (_req, res) => dashboardUsers('motorista', { bank: true }, res),

  // Clientes
  listClientsForAdmin: (req, res) => listUsersForAdmin('cliente', req, res),
  dashboardClients: (_req, res) => dashboardUsers('cliente', { isVerified: true }, res),

  // Empresas
  listCompaniesForAdmin,
  dashboardCompanies
};
