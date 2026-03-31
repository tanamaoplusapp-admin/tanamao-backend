const express = require('express');
const router = express.Router();
const pedidoCtrl = require('../controllers/pedidoController');

// Detalhes
router.get('/:id', pedidoCtrl.getPedidoById);

// Fluxo de entrega
router.put('/:id/iniciar-entrega', pedidoCtrl.iniciarEntrega);
router.put('/:id/atualizar-localizacao', pedidoCtrl.atualizarLocalizacao);
router.put('/:id/finalizar-entrega', pedidoCtrl.finalizarEntrega);

// Recusa com motivo
router.put('/:id/recusar', pedidoCtrl.recusarPedido);

// ===== Novos fluxos para as telas =====
router.put('/:id/aceitar', pedidoCtrl.aceitarPedido);
router.put('/:id/solicitar-motorista', pedidoCtrl.solicitarMotorista);
router.put('/:id/cancelar-solicitacao-motorista', pedidoCtrl.cancelarSolicitacaoMotorista);
router.put('/:id/finalizar', pedidoCtrl.finalizarPedido);

module.exports = router;
