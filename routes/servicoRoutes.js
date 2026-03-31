const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/servicoController');

// 🔐 Middleware de autenticação
const { verifyToken } = require('../middleware/verifyToken');

// 🔐 Bloqueio financeiro
const checkProfessionalAccess = require('../middleware/checkProfessionalAccess');


/* =====================================================
   ORDEM IMPORTA!
   Rotas específicas antes de /:id
===================================================== */


/**
 * 📋 Listar serviços do cliente
 */
router.get(
  '/cliente/:clienteId',
  verifyToken,
  ctrl.listByCliente
);


/**
 * 📋 Listar serviços do profissional
 */
router.get(
  '/profissional/:profissionalId',
  verifyToken,
  ctrl.listByProfissional
);


/**
 * 🔥 Serviço ativo do usuário logado
 */
router.get(
  '/ativo',
  verifyToken,
  ctrl.getServicoAtivo
);


/**
 * ➕ Criar solicitação de serviço
 */
router.post(
  '/',
  verifyToken,
  ctrl.createService
);


/**
 * 📅 Agendar serviço
 */
router.patch(
  '/:id/agendar',
  verifyToken,
  checkProfessionalAccess,
  ctrl.salvarAgendamento
);


/**
 * ✅ Aceitar serviço
 */
router.patch(
  '/:id/aceitar',
  verifyToken,
  checkProfessionalAccess,
  ctrl.aceitarService
);


/**
 * 🔄 Atualizar status
 */
router.put(
  '/:id/status',
  verifyToken,
  checkProfessionalAccess,
  ctrl.updateStatus
);


/**
 * 📍 Atualizar progresso (LOCALIZAÇÃO EM TEMPO REAL)
 */
router.put(
  '/:id/progress',
  verifyToken,
  checkProfessionalAccess,
  ctrl.updateProgress
);


/**
 * 🔎 Buscar por ID (sempre último)
 */
router.get(
  '/:id',
  verifyToken,
  ctrl.getServiceById
);


module.exports = router;