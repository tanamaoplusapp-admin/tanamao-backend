// routes/companyRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

/* -------------------- auth middleware (tolerante) -------------------- */
let verifyToken;
try { verifyToken = require('../middleware/authMiddleware'); } catch (_) {}
if (!verifyToken) { try { verifyToken = require('../middleware/auth'); } catch (_) {} }
if (!verifyToken) { try { verifyToken = require('../middleware/verifyToken'); } catch (_) {} }
if (!verifyToken) {
  throw new Error('Middleware de autenticação não encontrado (authMiddleware/auth/verifyToken).');
}

/* --------------------------- controllers ----------------------------- */
const companyController = require('../controllers/companyController');

// handlers com fallback seguro
const getOverviewHandler =
  companyController.getEmpresaOverview ||
  companyController.getDashboard ||
  ((_req, res) => res.status(501).json({ error: 'getEmpresaOverview não implementado.' }));

const assessHandler =
  companyController.assessCompanyPorte ||
  ((_req, res) => res.status(501).json({ error: 'assessCompanyPorte não implementado.' }));

/* --------------------------- rate limiters --------------------------- */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const assessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const nearbyLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ================================ Rotas =============================== */

// ✅ usado no RegisterEmpresaStep1 para pré-validação (email/CNPJ/porte)
router.post('/validate', registerLimiter, companyController.validateCompany);

// registro “compat” pelo controller da empresa
router.post('/register', registerLimiter, companyController.registerCompany);

// perfil da empresa logada
router.get('/me', verifyToken, companyController.getMyCompany);
router.put('/me', verifyToken, companyController.updateMyCompany);

// KPIs/overview do dashboard
router.get('/me/overview', verifyToken, getOverviewHandler);

// últimas avaliações e chats
router.get('/reviews/recent', verifyToken, companyController.getRecentReviews);
router.get('/chats/recent',  verifyToken, companyController.getRecentChats);

// empresas próximas (usa 2dsphere quando disponível; tem fallback)
router.get('/nearby', verifyToken, nearbyLimiter, companyController.getNearby);

// avaliação de porte (GET/POST)
router.get('/porte/assess',  assessLimiter, assessHandler);
router.post('/porte/assess', assessLimiter, assessHandler);

module.exports = router;
