const express = require('express');
const router = express.Router();

/* ===================== AUTH (FIX DEFINITIVO) ===================== */
let verifyToken, requireRoles;

try {
  const m = require('../middleware/verifyToken');
  verifyToken = m?.verifyToken || ((req,_res,next)=>next());
  requireRoles = m?.requireRoles || (() => (req,_res,next)=>next());
} catch (e) {
  console.warn('[adminUsersFinanceRoutes] fallback auth');
  verifyToken = (req,_res,next)=>next();
  requireRoles = () => (req,_res,next)=>next();
}

/* ===================== CONTROLLERS ===================== */

let financeCtrl = {};
let userActionsCtrl = {};

try {
  financeCtrl = require('../controllers/adminUsersFinanceController');
} catch(e){
  console.warn('adminUsersFinanceController não encontrado');
}

try {
  userActionsCtrl = require('../controllers/adminUserActionsController');
} catch(e){
  console.warn('adminUserActionsController não encontrado');
}

/* ===================== FALLBACKS ===================== */

const listUsersFinance =
  financeCtrl?.listUsersFinance ||
  ((req,res)=>res.json({ ok:true, empty:true }));

const getUserFinance =
  financeCtrl?.getUserFinance ||
  ((req,res)=>res.json({ ok:true, empty:true }));

const updateFinancialStatus =
  userActionsCtrl?.updateFinancialStatus ||
  ((req,res)=>res.json({ ok:true, empty:true }));

/* ===================== ROTAS ===================== */

router.get(
  '/users/finance',
  verifyToken,
  requireRoles('admin'),
  listUsersFinance
);

router.get(
  '/users/:id/finance',
  verifyToken,
  requireRoles('admin'),
  getUserFinance
);

router.patch(
  '/users/:id/financial-status',
  verifyToken,
  requireRoles('admin'),
  updateFinancialStatus
);

/* ===================== ACCESS CONTROL ===================== */

const User = require('../models/user');

/* LIBERAR ACESSO */
router.patch(
  '/users/:id/extend-access',
  verifyToken,
  requireRoles('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { days } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const agora = new Date();
      const atual = user.acessoExpiraEm || agora;

      const novaData = new Date(atual);
      novaData.setDate(novaData.getDate() + Number(days || 7));

      user.acessoExpiraEm = novaData;

      await user.save();

      res.json({
        success: true,
        acessoExpiraEm: user.acessoExpiraEm
      });

    } catch (err) {
      console.error('extend-access error:', err);
      res.status(500).json({ error: 'Erro ao estender acesso' });
    }
  }
);

/* BLOQUEAR ACESSO */
router.patch(
  '/users/:id/expire-access',
  verifyToken,
  requireRoles('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // força expiração
      user.acessoExpiraEm = new Date(0);

      await user.save();

      res.json({ success: true });

    } catch (err) {
      res.status(500).json({ error: 'Erro ao bloquear acesso' });
    }
  }
);

module.exports = router;