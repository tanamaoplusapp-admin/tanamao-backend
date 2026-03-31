const router = require('express').Router();
const controller = require('../controllers/agendaController');
const { verifyToken } = require('../middleware/verifyToken');

router.post('/', verifyToken, controller.criar);
router.get('/me', verifyToken, controller.listar);
router.get('/cliente', verifyToken, controller.listarCliente);
router.put('/:id', verifyToken, controller.editar);
router.delete('/:id', verifyToken, controller.cancelar);
module.exports = router;