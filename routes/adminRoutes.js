// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

/* ================= AUTH (NORMALIZADO) ================= */
const auth = require('../middleware/verifyToken');

const verifyToken =
typeof auth.verifyToken === 'function'
? auth.verifyToken
: (req,res,next)=>next();
const adminController = require('../controllers/adminController')
/* Guard admin seguro */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
  next();
}

/* ================= MODELS ================= */
const User = require('../models/user');
const Company = require('../models/company');
const Order = require('../models/order');
const Servico = require('../models/Servico');

let DriverModel = null;
try { DriverModel = require('../models/driver'); } catch (_) {}
if (!DriverModel) {
  try { DriverModel = require('../models/Motorista'); } catch (_) {}
}

/* ================= CONTROLLERS ================= */
let aprovarMotorista = null;
try {
  ({ aprovarMotorista } = require('../controllers/motoristaController'));
} catch (_) {}

/* ================= ROTAS FINANCEIRAS (NOVO) ================= */
// 🔴 ESSENCIAL: monta as rotas financeiras de usuários
const adminUsersFinanceRoutes = require('./adminUsersFinanceRoutes');
router.use('/', adminUsersFinanceRoutes);

/* ================= ROTAS ADMIN ================= */

// Ping admin
router.get('/', verifyToken, requireAdmin, (_req, res) => {
  res.json({ ok: true, message: 'Rota do administrador funcionando' });
});

// Health admin
router.get('/health', verifyToken, requireAdmin, (req, res) => {
  res.json({
    ok: true,
    user: { id: req.user?.id, role: req.user?.role },
    uptime: process.uptime(),
    now: new Date().toISOString(),
  });
});

// Stats overview
router.get('/stats/overview', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const [users, companies, orders, drivers] = await Promise.all([
      User.countDocuments({}),
      Company.countDocuments({}),
      Order.countDocuments({}),
      DriverModel ? DriverModel.countDocuments({}) : 0,
    ]);

    res.json({
      users,
      companies,
      orders,
      drivers,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin/stats/overview]', err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
});

/* ================= USUÁRIOS ================= */
// GET /api/admin/users
router.get('/users', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const Profissional = require('../models/Profissional');

    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const profissionais = await Profissional.find({})
      .sort({ createdAt: -1 })
      .lean();

    const usersMap = new Map(
      users.map((u) => [String(u._id), u])
    );

    const profissionaisMap = new Map(
      profissionais
        .filter((p) => p.userId)
        .map((p) => [String(p.userId), p])
    );

    const mergedUsers = users.map((user) => {
      const profissional = profissionaisMap.get(String(user._id));

      return {
        ...user,
        profissional: profissional || null,
        isProfissional: !!profissional || user.role === 'profissional',
        statusProfissional: profissional?.status || null,
        statusCadastro: profissional?.statusCadastro || null,
        aprovado: profissional?.aprovado || false
      };
    });

    const profissionaisSemUser = profissionais
      .filter((p) => !p.userId || !usersMap.has(String(p.userId)))
      .map((p) => ({
        _id: String(p.userId || p._id),
        name: p.name || 'Profissional sem usuário',
        email: p.email || '—',
        role: 'profissional',
        status: p.status || 'pendente',
        isVerified: false,
        createdAt: p.createdAt,
        profissional: p,
        isProfissional: true,
        statusProfissional: p.status || null,
        statusCadastro: p.statusCadastro || null,
        aprovado: p.aprovado || false
      }));

    res.json([...mergedUsers, ...profissionaisSemUser]);
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});
router.get('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const Profissional = require('../models/Profissional');

    const user = await User.findById(req.params.id).lean();

    if (user) {
      const profissional = await Profissional.findOne({ userId: user._id }).lean();

      return res.json({
        ...user,
        profissional: profissional || null,
        isProfissional: !!profissional || user.role === 'profissional',
        statusProfissional: profissional?.status || null,
        statusCadastro: profissional?.statusCadastro || null,
        aprovado: profissional?.aprovado || false,
      });
    }

    // fallback: profissional sem vínculo correto em User
    const profissional = await Profissional.findOne({
      $or: [
        { userId: req.params.id },
        { _id: req.params.id }
      ]
    }).lean();

    if (profissional) {
      return res.json({
        _id: String(profissional.userId || profissional._id),
        name: profissional.name || 'Profissional sem usuário',
        email: profissional.email || '—',
        role: 'profissional',
        status: profissional.status || 'pendente',
        isVerified: false,
        createdAt: profissional.createdAt,
        profissional,
        isProfissional: true,
        statusProfissional: profissional.status || null,
        statusCadastro: profissional.statusCadastro || null,
        aprovado: profissional.aprovado || false,
      });
    }

    return res.status(404).json({ error: 'Usuário não encontrado' });
  } catch (err) {
    console.error('[admin/users/:id]', err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});
/* ================= PEDIDOS ================= */

// GET /api/admin/orders
router.get('/orders', verifyToken, requireAdmin, async (_req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.json(orders);
  } catch (err) {
    console.error('[admin/orders]', err);
    res.status(500).json({ error: 'Erro ao listar pedidos' });
  }
});

/* ================= MOTORISTAS ================= */

router.get('/drivers/pendentes', verifyToken, requireAdmin, async (_req, res) => {
  try {
    if (!DriverModel) return res.json([]);

    const pendentes = await DriverModel.find({
      $or: [{ status: 'pendente' }, { aprovado: false }],
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(pendentes);
  } catch (err) {
    console.error('[admin/drivers/pendentes]', err);
    res.status(500).json({ error: 'Erro ao listar motoristas' });
  }
});

router.patch('/drivers/:id/aprovar', verifyToken, requireAdmin, async (req, res) => {
  try {
    if (aprovarMotorista) {
      return aprovarMotorista(req, res);
    }

    if (!DriverModel) {
      return res.status(400).json({ error: 'Modelo de motorista indisponível' });
    }

    const doc = await DriverModel.findByIdAndUpdate(
      req.params.id,
      { aprovado: true, status: 'aprovado' },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: 'Motorista não encontrado' });

    res.json({ message: 'Motorista aprovado', motorista: doc });
  } catch (err) {
    console.error('[admin/drivers/aprovar]', err);
    res.status(500).json({ error: 'Erro ao aprovar motorista' });
  }
});
router.get(
'/dashboard',
verifyToken,
requireAdmin,
async (_req,res)=>{

try{

const now = new Date()
const tenDaysAgo = new Date()
tenDaysAgo.setDate(now.getDate() - 10)

/* ================= USERS ================= */

const users = await User.find()

const profissionais =
users.filter(u=>u.role === 'profissional')

const bloqueados = profissionais.filter(
u => u.receberServicos === false
)

const novos10dias = users.filter(
u => new Date(u.createdAt) >= tenDaysAgo
).length

/* ================= ASSINATURAS ================= */

const assinaturasAtivas = profissionais.filter(
u => u.subscriptionStatus === 'active'
).length

const assinaturasExpiradas = profissionais.filter(
u => u.subscriptionStatus === 'expired'
).length

const inadimplentes = profissionais.filter(
u => u.subscriptionStatus === 'overdue'
).length

/* ================= RECEITA ================= */

let receitaTotal = 0
let receitaHoje = 0
let receitaSemana = 0
let receitaMes = 0

const startDay = new Date()
startDay.setHours(0,0,0,0)

const startWeek = new Date()
startWeek.setDate(now.getDate() - now.getDay())
startWeek.setHours(0,0,0,0)

const startMonth = new Date(
now.getFullYear(),
now.getMonth(),
1
)

profissionais.forEach(u=>{

if(!u.mensalidadesPagas) return

u.mensalidadesPagas.forEach(m=>{

const data = new Date(m.data || m.createdAt)

receitaTotal += m.valor || 0

if(data >= startDay)
receitaHoje += m.valor || 0

if(data >= startWeek)
receitaSemana += m.valor || 0

if(data >= startMonth)
receitaMes += m.valor || 0

})

})

/* ================= SERVIÇOS ================= */

const servicos = await Servico.find()

const aceitos =
servicos.filter(s=>s.status==='aceito').length

const cancelados =
servicos.filter(s=>s.status==='cancelado').length

const finalizados =
servicos.filter(s=>s.status==='finalizado').length

let faturamento = 0

servicos.forEach(s=>{
faturamento += s.valorPago || 0
})

res.json({

services:{
aceitos,
cancelados,
finalizados,
faturamento
},

finance:{
receitaTotal,
receitaHoje,
receitaSemana,
receitaMes,
assinaturasAtivas,
assinaturasExpiradas,
inadimplentes
},

users:{
total:users.length,
profissionais:profissionais.length,
bloqueados:bloqueados.length,
novos10dias
}

})

}catch(e){
res.status(500).json({erro:e.message})
}

}
)
router.patch(
  '/users/:id/status',
  verifyToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      user.status = status;

      await user.save();

      res.json({
        success: true,
        status: user.status
      });

    } catch (err) {
      res.status(500).json({ error: 'Erro ao alterar status' });
    }
  }
);
module.exports = router;