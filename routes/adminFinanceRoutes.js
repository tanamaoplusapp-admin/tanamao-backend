const express = require('express');
const router = express.Router();

const auth = require('../middleware/verifyToken');

const verifyToken =
  auth?.verifyToken || ((req,res,next)=>next());

const requireRoles =
  auth?.requireRoles || (() => (req,res,next)=>next());

const User = require('../models/user');
const PagamentoMensalidade = require('../models/PagamentoMensalidade');

const can = requireRoles(
  'superadmin',
  'admin',
  'financeiro',
  'admin-ops',
  'cfo',
  'coo'
);

router.use('/', verifyToken, can);

const startOfDay = d =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const startOfWeek = d => {
  const x = new Date(startOfDay(d));
  const wd = (x.getDay()+6)%7;
  x.setDate(x.getDate()-wd);
  return x;
};

const startOfMonth = d =>
  new Date(d.getFullYear(), d.getMonth(), 1);

async function sumMensalidades(from){

const rows = await PagamentoMensalidade.aggregate([
{
$match:{
status:'pago',
paidAt:{ $gte: from }
}
},
{
$group:{
_id:null,
total:{ $sum:'$valor' }
}
}
]);

return rows[0]?.total || 0;

}

async function sumComissoes(){

const users = await User.find();

let total = 0;

users.forEach(u=>{
total += u.comissaoTotalPaga || 0;
});

return total;

}

router.get('/finance/summary', async (_req, res) => {
  try {

    const now = new Date();

    const [todayMensal, weekMensal, monthMensal] =
    await Promise.all([
      sumMensalidades(startOfDay(now)),
      sumMensalidades(startOfWeek(now)),
      sumMensalidades(startOfMonth(now)),
    ]);

    const comissoes = await sumComissoes();

    return res.json({
      today: todayMensal,
      week: weekMensal,
      month: monthMensal,
      comissoes,
      total: monthMensal + comissoes
    });

  } catch (e) {

    console.error('[finance.summary]', e);

    return res.status(500).json({
      message: 'Falha ao calcular resumo'
    });

  }
});

router.get(
  '/finance/transactions',
  verifyToken,
  async (req, res) => {
    try {

      const PagamentoMensalidade =
        require('../models/PagamentoMensalidade')

      const WebhookEvent =
        require('../models/WebhookEvent')

      const mensalidades =
        await PagamentoMensalidade.find()
        .populate('user')
        .sort({ createdAt: -1 })
        .limit(100)

      const webhooks =
        await WebhookEvent.find()
        .sort({ createdAt: -1 })
        .limit(100)

      res.json([
        ...mensalidades,
        ...webhooks
      ])

    } catch (error) {

      console.error(error)

      res.status(500).json({
        error: 'Erro ao carregar transações'
      })

    }
  }
)

module.exports = router;