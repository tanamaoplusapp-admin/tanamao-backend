const express = require('express');
const router = express.Router();

const auth = require('../middleware/verifyToken');
const verifyToken = auth?.verifyToken || ((req,res,next)=>next());

const CategoriaPrestador = require('../models/CategoriaPrestador');

/* ======================================================
   🌍 LISTAR CATEGORIAS ATIVAS (PÚBLICO)
====================================================== */

router.get('/', async (_req, res) => {
  try {
    const categorias = await CategoriaPrestador
      .find({ active: true })
      .sort({ ordem: 1, name: 1 })
      .lean();

    return res.json({ ok: true, data: categorias });
  } catch (err) {
    console.error('categoriaPrestador.list', err);
    return res.status(500).json({
      ok:false,
      message:'Erro ao listar categorias'
    });
  }
});

/* ======================================================
   🔒 ADMIN — CRIAR CATEGORIA
====================================================== */

router.post('/', verifyToken, async (req, res) => {
  try {

    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        ok:false,
        message:'Acesso negado'
      });
    }

    const { name, slug, ordem } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        ok:false,
        message:'Nome e slug são obrigatórios'
      });
    }

    const existente = await CategoriaPrestador.findOne({
      $or: [{ name }, { slug }]
    });

    if (existente) {
      return res.status(400).json({
        ok:false,
        message:'Categoria já existe'
      });
    }

    const categoria = await CategoriaPrestador.create({
      name,
      slug,
      ordem: ordem || 0
    });

    return res.status(201).json({
      ok:true,
      data:categoria
    });

  } catch (err) {

    console.error('categoriaPrestador.create', err);

    return res.status(500).json({
      ok:false,
      message:'Erro ao criar categoria'
    });

  }
});

/* ======================================================
   🔒 ADMIN — ATUALIZAR
====================================================== */

router.put('/:id', verifyToken, async (req, res) => {
  try {

    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        ok:false,
        message:'Acesso negado'
      });
    }

    const categoria =
      await CategoriaPrestador.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new:true }
      );

    if (!categoria) {
      return res.status(404).json({
        ok:false,
        message:'Categoria não encontrada'
      });
    }

    return res.json({
      ok:true,
      data:categoria
    });

  } catch (err) {

    console.error('categoriaPrestador.update', err);

    return res.status(500).json({
      ok:false,
      message:'Erro ao atualizar categoria'
    });

  }
});

/* ======================================================
   🔒 ADMIN — TOGGLE
====================================================== */

router.patch('/:id/toggle', verifyToken, async (req, res) => {
  try {

    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        ok:false,
        message:'Acesso negado'
      });
    }

    const categoria =
      await CategoriaPrestador.findById(req.params.id);

    if (!categoria) {
      return res.status(404).json({
        ok:false,
        message:'Categoria não encontrada'
      });
    }

    categoria.active = !categoria.active;

    await categoria.save();

    return res.json({
      ok:true,
      data:categoria
    });

  } catch (err) {

    console.error('categoriaPrestador.toggle', err);

    return res.status(500).json({
      ok:false,
      message:'Erro ao alterar status'
    });

  }
});

module.exports = router;