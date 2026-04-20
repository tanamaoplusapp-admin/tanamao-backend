const express = require('express');
const router = express.Router();

/* ================= AUTH (FIX DEFINITIVO) ================= */
let verifyToken;

try {
  const auth = require('../middleware/verifyToken');
  verifyToken = auth.verifyToken;
} catch (_) {
  try {
    const auth = require('../middleware/authMiddleware');
    verifyToken = auth.verifyToken || auth;
  } catch (_) {
    verifyToken = null;
  }
}

if (typeof verifyToken !== 'function') {
  verifyToken = (_req, _res, next) => next();
}

/* ================= MODELS NOVOS ================= */
const Categoria = require('../models/Categoria');
const Profissao = require('../models/Profissao');

/* ================= CONTROLLERS ================= */
const ctrl = require('../controllers/profissionaisController');
const solicitacoesCtrl = require('../controllers/solicitacoesController');
const ofertaCtrl = require('../controllers/ofertaController');

/* =========================================================
   🌍 ROTAS PÚBLICAS (ANTES DE TUDO)
========================================================= */

// 🔥 LISTAR PROFISSIONAIS (com filtros)
router.get('/', ctrl.list);

// 🔥 NOVO — LISTAR CATEGORIAS
router.get('/categorias', async (req, res) => {
  try {
    const data = await Categoria.find({ ativa: true }).lean();
    return res.json({ ok: true, data });
  } catch (e) {
    console.error('categorias.list:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao listar categorias',
    });
  }
});

// 🔥 NOVO — LISTAR PROFISSÕES
router.get('/profissoes', async (req, res) => {
  try {
    const { categoriaId } = req.query;

    const filtro = { ativa: true };

    if (categoriaId) filtro.categoriaId = categoriaId;

    const data = await Profissao.find(filtro).lean();

    return res.json({ ok: true, data });
  } catch (e) {
    console.error('profissoes.list:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao listar profissões',
    });
  }
});
// 🔥 NOVO — CATÁLOGO DE SOCORRO AUTOMOTIVO
router.get('/catalogos/socorro-automotivo', (_req, res) => {
  return res.json({
    ok: true,
    data: [
      { codigo: 'pneu_furado', label: 'Pneu furado' },
      { codigo: 'bateria_descarregada', label: 'Bateria descarregada' },
      { codigo: 'guincho', label: 'Guincho' },
      { codigo: 'sem_combustivel', label: 'Sem combustível' },
      { codigo: 'pane_eletrica', label: 'Pane elétrica' },
      { codigo: 'problema_motor', label: 'Problema no motor' },
    ],
  });
});
/* =========================================================
   🔒 ROTAS AUTENTICADAS
========================================================= */

// PERFIL
router.get('/me', verifyToken, ctrl.getMe);
router.put('/me', verifyToken, ctrl.updateMe);
router.put('/me/banco', verifyToken, ctrl.updateBank);
router.put('/alterar-senha', verifyToken, ctrl.alterarSenha);

router.get(
  '/me/resumo',
  verifyToken,
  ctrl.getResumoProfissionalLogado
);

// STATUS (LEGADO)
router.patch('/me/status', verifyToken, ctrl.updateStatus);

/* =========================================================
   📦 RELACIONADOS AO PROFISSIONAL
========================================================= */

// Solicitações
router.get(
  '/:id/solicitacoes',
  verifyToken,
  solicitacoesCtrl.listByProfissional
);

/* ================= OFERTAS ================= */

// Criar oferta
router.post('/:id/ofertas', verifyToken, ofertaCtrl.criar);

// Listar ofertas
router.get('/:id/ofertas', ofertaCtrl.listarPorProfissional);

// Atualizar oferta
router.patch('/:id/ofertas/:ofertaId', verifyToken, ofertaCtrl.atualizar);

// Excluir oferta
router.delete('/:id/ofertas/:ofertaId', verifyToken, ofertaCtrl.excluir);

/* =========================================================
   🔎 PERFIL PÚBLICO (SEMPRE POR ÚLTIMO)
========================================================= */

router.get('/:id', ctrl.getById);


module.exports = router;