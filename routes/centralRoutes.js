// routes/centralRoutes.js
const express = require('express');
const router = express.Router();
const centralController = require('../controllers/centralController');

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

// ================================
// Exporta router
// ================================
module.exports = router;
