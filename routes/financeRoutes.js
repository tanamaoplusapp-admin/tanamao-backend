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
router.patch(
  '/users/:id/extend-access',
  verifyToken,
  requireRoles('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { days } = req.body;

      const User = require('../models/user');
      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const now = new Date();
      const atual = user.accessExpiresAt || now;

      const novaData = new Date(atual);
      novaData.setDate(novaData.getDate() + (days || 7));

      user.accessExpiresAt = novaData;
      user.subscriptionStatus = 'active';

      await user.save();

      res.json({
        success: true,
        accessExpiresAt: user.accessExpiresAt
      });

    } catch (err) {
      console.error('extend-access error:', err);
      res.status(500).json({ error: 'Erro ao estender acesso' });
    }
  }
);
module.exports = router;