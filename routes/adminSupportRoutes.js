// routes/adminSupportRoutes.js
const express = require('express');
const router = express.Router();

/** —— Auth middleware (compatível com diferentes exports) —— */
let verifyModule = null;
try { verifyModule = require('../middleware/verifyToken'); } catch {}
const verifyToken =
  (typeof verifyModule === 'function')
    ? verifyModule
    : (verifyModule && typeof verifyModule.verifyToken === 'function')
      ? verifyModule.verifyToken
      : (_req, _res, next) => next(); // no-op (ideal é ter auth!)

const requireRoles =
  (verifyModule && typeof verifyModule.requireRoles === 'function')
    ? verifyModule.requireRoles
    : () => (_req, _res, next) => next(); // no-op se não existir

/** —— Controller —— */
let ctrl = {};
try { ctrl = require('../controllers/supportController'); } catch { ctrl = {}; }

// helper: garante sempre uma função pro Express
const h = (fn) => (req, res, next) =>
  (typeof fn === 'function' ? fn(req, res, next) : res.status(501).json({ message: 'Not implemented' }));

// Papéis que podem gerenciar suporte
const canManageSupport = ['superadmin', 'admin', 'suporte', 'admin-ops', 'cto', 'cx'];

router.use(verifyToken, requireRoles(...canManageSupport));

// KPIs
router.get('/tickets/count', h(ctrl.count));

// Tickets
router.get('/tickets', h(ctrl.adminList));
router.get('/tickets/:id', h(ctrl.adminGet));
router.post('/tickets/:id/reply', h(ctrl.replyAsAgent));
router.post('/tickets/:id/close', h(ctrl.close));

// KB (somente leitura aqui; CRUD pode ser adicionado depois)
router.get('/kb', h(ctrl.kbList));
router.get('/kb/:id', h(ctrl.kbGet));

module.exports = router;
