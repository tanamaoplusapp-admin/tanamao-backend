const express = require('express');
const router = express.Router();

/**
 * =====================================================
 * AUTH MIDDLEWARE
 * =====================================================
 */
const { verifyToken, requireRoles } = require('../middleware/verifyToken');

/**
 * =====================================================
 * CONTROLLER
 * =====================================================
 */
const controller = require('../controllers/adminUserActionsController');

if (typeof controller.updateFinancialStatus !== 'function') {
  console.error('❌ updateFinancialStatus NÃO foi exportado corretamente');
}

if (typeof controller.updateUserStatus !== 'function') {
  console.error('❌ updateUserStatus NÃO foi exportado corretamente');
}

if (typeof controller.updateUserDocumentStatus !== 'function') {
  console.error('❌ updateUserDocumentStatus NÃO foi exportado corretamente');
}

// ================================
// FINANCEIRO
// ================================
router.patch(
  '/users/:id/financial-status',
  verifyToken,
  requireRoles('admin'),
  controller.updateFinancialStatus
);

// ================================
// STATUS DO USUÁRIO
// ================================
router.patch(
  '/users/:id/status',
  verifyToken,
  requireRoles('admin'),
  controller.updateUserStatus
);

// ================================
// DOCUMENTOS DO USUÁRIO
// ================================
router.patch(
  '/users/:id/document-status',
  verifyToken,
  requireRoles('admin'),
  controller.updateUserDocumentStatus
);

module.exports = router;
