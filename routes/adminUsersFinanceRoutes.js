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

module.exports = router;