const express = require('express');
const router = express.Router();

const financeCtrl = require('../controllers/financeController');
const { verifyToken, requireRoles } = require('../middleware/verifyToken');

/* =====================================================
   RESUMO FINANCEIRO (ADMIN + PROFISSIONAL)
===================================================== */

router.get(
  '/summary',
  verifyToken,
  requireRoles('admin','profissional'),
  financeCtrl.summary
);

/* =====================================================
   LISTA DE TRANSAÇÕES
===================================================== */

router.get(
  '/transactions',
  verifyToken,
  requireRoles('admin','profissional'),
  financeCtrl.listTransactions
);

/* =====================================================
   CONSULTAR COMISSÃO
===================================================== */

router.get(
  '/commission',
  verifyToken,
  requireRoles('admin','profissional'),
  financeCtrl.getCommission
);

/* =====================================================
   STATUS FINANCEIRO
===================================================== */

router.get(
  '/status',
  verifyToken,
  requireRoles('admin','profissional'),
  financeCtrl.status
);

/* =====================================================
   ALTERAR PLANO
===================================================== */

router.post(
  '/change-plan',
  verifyToken,
  requireRoles('admin','profissional'),
  financeCtrl.changePlan
);

/* =====================================================
   PAGAR COMISSÃO
===================================================== */

router.post(
  '/pay-commission',
  verifyToken,
  requireRoles('profissional'),
  financeCtrl.generateCommissionPix
);

/* =====================================================
   DASHBOARD ADMIN (RECEITA GLOBAL)
===================================================== */

router.get(
  '/admin-summary',
  verifyToken,
  requireRoles('admin'),
  financeCtrl.adminSummary
);

module.exports = router;