// backend/routes/featureFlagRoutes.js
const express = require('express');
const router = express.Router();
const { list, getForUser, create, update, remove } = require('../controllers/featureFlagController');
const verifyToken = require('../middleware/verifyToken'); // default export

// Admin (lista/CRUD) — se quiser exigir admin, use a opção B
router.get('/', verifyToken, list);
router.post('/', verifyToken, create);
router.patch('/:id', verifyToken, update);
router.delete('/:id', verifyToken, remove);

// App (resolve flags para um usuário)
router.get('/resolve', verifyToken, getForUser);

module.exports = router;
