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
    const users = await User.find({})
      .select('name email role isVerified createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.json(users);
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (err) {
    console.error('[admin/users/:id]', err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role, isVerified } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(role && { role }),
        ...(isVerified !== undefined && { isVerified }),
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    res.json(user);
  } catch (err) {
    console.error('[admin/users PATCH]', err);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
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