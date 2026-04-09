// routes/centralRoutes.js
const express = require('express');
const router = express.Router();
const centralController = require('../controllers/centralController');

// 🔐 corrigido caminho
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');

// 🔐 protege TODA central
router.use(verifyToken, requireAdmin);

// Dashboard geral
router.get('/dashboard', centralController.getCentralDashboard);

// ================================
// Profissionais
// ================================
router.get('/profissionais', centralController.listProfessionalsForAdmin);
router.get('/profissionais/dashboard', centralController.dashboardProfessionals);

// ================================
// Motoristas
// ================================
router.get('/motoristas', centralController.listDriversForAdmin);
router.get('/motoristas/dashboard', centralController.dashboardDrivers);

// ================================
// Clientes
// ================================
router.get('/clientes', centralController.listClientsForAdmin);
router.get('/clientes/dashboard', centralController.dashboardClients);

// ================================
// Empresas
// ================================
router.get('/empresas', centralController.listCompaniesForAdmin);
router.get('/empresas/dashboard', centralController.dashboardCompanies);

module.exports = router;