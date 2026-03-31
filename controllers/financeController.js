// controllers/financeController.js

const Transaction = require('../models/Transaction');
const User = require('../models/user');
const { mp, Payment } = require('../services/mercadoPago');

const COMMISSION_LIMIT = 500;

/* =========================================================
UTIL
========================================================= */

const startOf = (unit) => {

  const d = new Date();

  if (unit === 'day') d.setHours(0, 0, 0, 0);

  if (unit === 'week') {
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
  }

  if (unit === 'month') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }

  return d;
};


/* =========================================================
RESUMO FINANCEIRO
========================================================= */

exports.summary = async (req, res) => {

  try {

    const userId = req.user.id;

    const user = await User.findById(userId);

    const hoje = startOf('day');
    const semana = startOf('week');
    const mes = startOf('month');

    // COMISSÕES PAGAS
    const comissoes =
      user.comissaoTotalPaga || 0;

    // MENSALIDADES PAGAS
    const mensalidades =
      user.mensalidadesPagas?.reduce(
        (acc,m)=> acc + (m.valor || 0),
        0
      ) || 0;

    // TRANSAÇÕES PIX (SERVIÇOS)
    const [todayTx, weekTx, monthTx] = await Promise.all(
      [hoje, semana, mes].map(async (from) => {

        const rows = await Transaction.aggregate([
          {
            $match: {
              profissional: userId,
              createdAt: { $gte: from },
              status: 'approved',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
            },
          },
        ]);

        return rows[0]?.total || 0;

      })
    );

    res.json({

      today: todayTx,

      week: weekTx,

      month: monthTx,

      comissoes,

      mensalidades,

      total: comissoes + mensalidades

    });

  } catch (err) {

    console.error('finance.summary:', err);

    res.status(500).json({
      message: 'Erro ao gerar resumo financeiro',
    });

  }

};
exports.adminSummary = async (req,res)=>{

const users = await User.find();

let comissoes = 0;
let mensalidades = 0;

users.forEach(u=>{

comissoes += u.comissaoTotalPaga || 0;

if(u.mensalidadesPagas){
u.mensalidadesPagas.forEach(m=>{
mensalidades += m.valor || 0;
});
}

});

res.json({
today: comissoes + mensalidades,
month: comissoes + mensalidades
});

};
/* =========================================================
LISTA DE TRANSAÇÕES
========================================================= */

exports.listTransactions = async (req, res) => {

  try {

    const userId = req.user.id;

    const limit = Math.min(Number(req.query.limit || 50), 200);

    const items = await Transaction.find({
      profissional: userId
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ items });

  } catch (err) {

    console.error('finance.listTransactions:', err);

    res.status(500).json({
      message: 'Erro ao listar transações',
    });

  }
};


/* =========================================================
STATUS FINANCEIRO DO PROFISSIONAL
========================================================= */

exports.status = async (req, res) => {

  try {

    const userId = req.user.id;

    const user = await User.findById(userId);

    const comissaoPendente = user.comissaoPendente || 0;

    const mensalidadePendente =
      user.subscriptionStatus === 'overdue';

    res.json({
      plan: user.planType,
      commissionDebt: comissaoPendente,
      mensalidadePendente,
      commissionLimit: COMMISSION_LIMIT
    });

  } catch (err) {

    console.error('finance.status:', err);

    res.status(500).json({
      message: 'Erro ao verificar status financeiro'
    });

  }

};


/* =========================================================
COMISSÃO DO PROFISSIONAL
========================================================= */

exports.getCommission = async (req, res) => {

  try {

    const userId = req.user._id || req.user.id;

    const user = await User.findById(userId)
      .select('comissaoPendente planType receberServicos');

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado'
      });
    }

    const pendente = user.comissaoPendente || 0;

    const restante = Math.max(COMMISSION_LIMIT - pendente, 0);

    return res.json({

      pending: pendente,

      limit: COMMISSION_LIMIT,

      remaining: restante,

      blocked: !user.receberServicos,

      planType: user.planType

    });

  } catch (err) {

    console.error('finance.getCommission:', err);

    return res.status(500).json({
      message: 'Erro ao consultar comissão'
    });

  }
};


/* =========================================================
ALTERAR PLANO
========================================================= */

exports.changePlan = async (req, res) => {
  console.log('PLAN RECEBIDO:', req.body.plan)


  try {

    const userId = req.user.id;
    const { plan } = req.body;

    const user = await User.findById(userId)

console.log('DIVIDA COMISSAO:', user.comissaoPendente)
console.log('STATUS SUBSCRIPTION:', user.subscriptionStatus)


    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado'
      });
    }

    /* BLOQUEAR TROCA SE HOUVER DÍVIDA */

    if (
      user.comissaoPendente > 0 ||
      user.subscriptionStatus === 'overdue'
    ) {
      return res.status(400).json({
        message:
          'Regularize suas pendências antes de alterar o plano'
      });
    }

    /* PLANOS PERMITIDOS */

    const allowedPlans = [
      'comissao',
      'mensal_comissao',
      'profissional'
    ];

    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({
        message: 'Plano inválido'
      });
    }

    /* =============================
       PLANO COMISSÃO (ATIVA DIRETO)
    ============================== */

    if (plan === 'comissao') {

      user.planType = 'comissao';
      user.comissaoPercentual = 0.15;
      user.mensalidadeValor = 0;
      user.subscriptionStatus = 'active';

      await user.save();

      return res.json({
        success: true,
        plan: user.planType
      });
    }

    /* =============================
       PLANOS PAGOS
    ============================== */

    if (plan === 'mensal_comissao') {

  user.planType = 'mensal_comissao';
  user.comissaoPercentual = 0.05;
  user.mensalidadeValor = 99;
  user.subscriptionStatus = 'active';

  await user.save();

  return res.json({
    success: true,
    plan: user.planType
  });

}

if (plan === 'profissional') {

  user.planType = 'profissional';
  user.comissaoPercentual = 0;
  user.mensalidadeValor = 199;
  user.subscriptionStatus = 'active';

  await user.save();

  return res.json({
    success: true,
    plan: user.planType
  });

}


  } catch (err) {

    console.error('finance.changePlan:', err);

    res.status(500).json({
      message: 'Erro ao alterar plano'
    });

  }

};



/* =========================================================
VERIFICAR BLOQUEIO POR COMISSÃO
========================================================= */

exports.checkCommissionLimit = async (userId) => {

  const user = await User.findById(userId);

  if (!user) return;

  if (user.comissaoPendente >= COMMISSION_LIMIT) {

    user.receberServicos = false;

    await user.save();

  }

};


/* =========================================================
GERAR PIX PARA PAGAR COMISSÃO
========================================================= */

exports.generateCommissionPix = async (req, res) => {

  try {

    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado'
      });
    }

    const valor = user.comissaoPendente || 0;

    if (valor <= 0) {
      return res.status(400).json({
        message: 'Não há comissão pendente'
      });
    }

const payment = await new Payment(mp).create({
  body: {
    transaction_amount: valor,

    description: 'Pagamento de comissão - Tanamão',

    payment_method_id: 'pix',

    payer: {
      email: user.email,
      first_name: user.name
    },

    metadata: {
      user_id: String(user._id),
      type: 'commission'
    }

  }
});
    const tx = payment?.point_of_interaction?.transaction_data;

    return res.json({

      paymentId: payment.id,

      valor,

      qr_code: tx?.qr_code,

      qr_code_base64: tx?.qr_code_base64

    });

  } catch (err) {

    console.error('finance.generateCommissionPix:', err);

    return res.status(500).json({
      message: 'Erro ao gerar PIX da comissão'
    });

  }

};