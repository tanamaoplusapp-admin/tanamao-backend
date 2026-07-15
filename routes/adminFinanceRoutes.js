// routes/adminFinanceRoutes.js

const express = require('express');
const router = express.Router();

const auth = require('../middleware/verifyToken');

const verifyToken =
  auth?.verifyToken || ((req, res, next) => next());

const requireRoles =
  auth?.requireRoles || (() => (req, res, next) => next());

const Transaction = require('../models/transaction');
const User = require('../models/user');

/* =========================================================
   PERMISSÕES
========================================================= */

const can = requireRoles(
  'superadmin',
  'admin',
  'financeiro',
  'admin-ops',
  'cfo',
  'coo'
);

router.use('/', verifyToken, can);

/* =========================================================
   HELPERS DE DATA
========================================================= */

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = startOfDay(date);

  // Semana começando na segunda-feira
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;

  d.setDate(d.getDate() - diff);

  return d;
}

function startOfMonth(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

/* =========================================================
   HELPER RECEITA
   Considera somente pagamentos aprovados
========================================================= */

async function sumApprovedTransactions(from) {
  const result = await Transaction.aggregate([
    {
      $match: {
        status: 'approved',
        createdAt: {
          $gte: from,
        },
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: '$amount',
        },
      },
    },
  ]);

  return result[0]?.total || 0;
}

/* =========================================================
   GET /api/admin/finance/summary

   RESUMO FINANCEIRO REAL
========================================================= */

router.get('/finance/summary', async (_req, res) => {
  try {
    const now = new Date();

    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    /* =========================
       RECEITAS
    ========================= */

    const [
      today,
      week,
      month,
    ] = await Promise.all([
      sumApprovedTransactions(dayStart),
      sumApprovedTransactions(weekStart),
      sumApprovedTransactions(monthStart),
    ]);

    /* =========================
       STATUS DOS PAGAMENTOS
    ========================= */

    const [
      aprovados,
      pendentes,
      rejeitados,
      emProcessamento,
    ] = await Promise.all([
      Transaction.countDocuments({
        status: 'approved',
      }),

      Transaction.countDocuments({
        status: 'pending',
      }),

      Transaction.countDocuments({
        status: {
          $in: [
            'rejected',
            'failed',
            'cancelled',
          ],
        },
      }),

      Transaction.countDocuments({
        status: 'in_process',
      }),
    ]);

    /* =========================
       CONCILIAÇÃO
       Pagamento aprovado mas
       acesso não aplicado
    ========================= */

    const divergencias =
      await Transaction.countDocuments({
        status: 'approved',
        aplicadoAoUsuario: false,
      });

    /* =========================
       PROFISSIONAIS COM ACESSO
    ========================= */

    const ativos = await User.countDocuments({
      role: 'profissional',
      acessoExpiraEm: {
        $gt: now,
      },
    });

    const expirados = await User.countDocuments({
      role: 'profissional',
      acessoExpiraEm: {
        $lte: now,
      },
    });

    /* =========================
       ATIVAÇÕES POR PLANO

       Conta pagamentos aprovados
       que realmente foram aplicados
    ========================= */

    const plano1Dia =
      await Transaction.countDocuments({
        status: 'approved',
        aplicadoAoUsuario: true,
        planoAplicado: '1_dia',
      });

    const plano7Dias =
      await Transaction.countDocuments({
        status: 'approved',
        aplicadoAoUsuario: true,
        planoAplicado: '7_dias',
      });

    const plano15Dias =
      await Transaction.countDocuments({
        status: 'approved',
        aplicadoAoUsuario: true,
        planoAplicado: '15_dias',
      });

    const plano30Dias =
      await Transaction.countDocuments({
        status: 'approved',
        aplicadoAoUsuario: true,
        planoAplicado: '30_dias',
      });

    /* =========================
       RECEITA TOTAL APROVADA
    ========================= */

    const totalResult =
      await Transaction.aggregate([
        {
          $match: {
            status: 'approved',
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$amount',
            },
          },
        },
      ]);

    const total =
      totalResult[0]?.total || 0;

    /* =========================
       RESPOSTA
    ========================= */

    return res.json({
      today,
      week,
      month,
      total,

      ativos,
      expirados,

      pendentes,
      aprovados,
      rejeitados,
      emProcessamento,

      divergencias,

      planos: {
        '1_dia': plano1Dia,
        '7_dias': plano7Dias,
        '15_dias': plano15Dias,
        '30_dias': plano30Dias,
      },
    });

  } catch (error) {
    console.error(
      '[adminFinanceRoutes][summary]',
      error
    );

    return res.status(500).json({
      message:
        'Erro ao carregar resumo financeiro',
    });
  }
});

/* =========================================================
   GET /api/admin/finance/transactions

   LISTA TRANSAÇÕES REAIS
========================================================= */

router.get(
  '/finance/transactions',
  async (req, res) => {
    try {
      const {
        status,
        type,
        paymentMethod,
        limit = 200,
      } = req.query;

      const filter = {};

      /* =========================
         FILTROS OPCIONAIS
      ========================= */

      if (status) {
        filter.status = status;
      }

      if (type) {
        filter.type = type;
      }

      if (paymentMethod) {
        filter.paymentMethod =
          paymentMethod;
      }

      /* =========================
         LIMITE SEGURO
      ========================= */

      const safeLimit = Math.min(
        Math.max(
          Number(limit) || 200,
          1
        ),
        500
      );

      /* =========================
         BUSCA
      ========================= */

      const transactions =
        await Transaction.find(filter)
          .populate(
            'userId',
            'name email role planoAtivo acessoExpiraEm'
          )
          .sort({
            createdAt: -1,
          })
          .limit(safeLimit)
          .lean();

      /* =========================
         NORMALIZAÇÃO PARA FRONTEND
      ========================= */

      const items =
        transactions.map((tx) => ({
          _id: tx._id,

          id:
            tx.mpPaymentId ||
            tx.paymentId ||
            tx._id,

          mpPaymentId:
            tx.mpPaymentId ||
            null,

          user: tx.userId
            ? {
                _id:
                  tx.userId._id,

                name:
                  tx.userId.name,

                email:
                  tx.userId.email,

                role:
                  tx.userId.role,

                planoAtivo:
                  tx.userId.planoAtivo,

                acessoExpiraEm:
                  tx.userId.acessoExpiraEm,
              }
            : null,

          amount:
            tx.amount || 0,

          valorPago:
            tx.valorPago,

          valorEsperado:
            tx.valorEsperado,

          status:
            tx.status,

          type:
            tx.type,

          paymentMethod:
            tx.paymentMethod,

          method:
            tx.method,

          description:
            tx.description,

          aplicadoAoUsuario:
            tx.aplicadoAoUsuario,

          aplicadoEm:
            tx.aplicadoEm,

          diasLiberados:
            tx.diasLiberados,

          planoAplicado:
            tx.planoAplicado,

          acessoExpiraEm:
            tx.acessoExpiraEm,

          motivoNaoAplicado:
            tx.motivoNaoAplicado,

          createdAt:
            tx.createdAt,

          updatedAt:
            tx.updatedAt,
        }));

      return res.json(items);

    } catch (error) {
      console.error(
        '[adminFinanceRoutes][transactions]',
        error
      );

      return res.status(500).json({
        message:
          'Erro ao carregar transações financeiras',
      });
    }
  }
);

/* =========================================================
   GET /api/admin/finance/reconciliation

   CONCILIAÇÃO

   Mostra pagamentos aprovados
   que não foram aplicados ao usuário
========================================================= */

router.get(
  '/finance/reconciliation',
  async (_req, res) => {
    try {

      const divergencias =
        await Transaction.find({
          status: 'approved',
          aplicadoAoUsuario: false,
        })
          .populate(
            'userId',
            'name email role planoAtivo acessoExpiraEm'
          )
          .sort({
            createdAt: -1,
          })
          .lean();

      const items =
        divergencias.map((tx) => ({
          _id: tx._id,

          mpPaymentId:
            tx.mpPaymentId,

          user:
            tx.userId || null,

          amount:
            tx.amount,

          valorPago:
            tx.valorPago,

          valorEsperado:
            tx.valorEsperado,

          status:
            tx.status,

          type:
            tx.type,

          paymentMethod:
            tx.paymentMethod,

          aplicadoAoUsuario:
            tx.aplicadoAoUsuario,

          motivoNaoAplicado:
            tx.motivoNaoAplicado,

          planoAplicado:
            tx.planoAplicado,

          diasLiberados:
            tx.diasLiberados,

          createdAt:
            tx.createdAt,
        }));

      return res.json({
        total: items.length,
        items,
      });

    } catch (error) {
      console.error(
        '[adminFinanceRoutes][reconciliation]',
        error
      );

      return res.status(500).json({
        message:
          'Erro ao carregar conciliação financeira',
      });
    }
  }
);

module.exports = router;