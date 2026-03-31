const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const BugsController = require('../controllers/bugsController');

// 📌 Reportar bug (qualquer usuário)
router.post('/report', (req, res, next) => {
  if (req.headers.authorization) {
    return verifyToken(req, res, () => next());
  }
  return next();
}, BugsController.report);

// 🔒 Admin only
router.use(verifyToken, (req, res, next) => {
  if ((req.user?.role || '').toLowerCase() !== 'admin')
    return res.status(403).json({ message: 'Acesso negado' });
  next();
});

/* IMPORTANTE: rotas específicas primeiro */

router.get('/', BugsController.list);
router.get('/count', BugsController.countOpen);
router.get('/:id/logs', BugsController.logs);
router.post('/:id/start', BugsController.start);
router.post('/:id/resolve', BugsController.resolve);
router.post('/:id/reopen', BugsController.reopen);
router.get('/:id', BugsController.get);

module.exports = router;