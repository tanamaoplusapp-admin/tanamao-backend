// backend/routes/driverStatusRoutes.js
const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken'); // default export (function)
const { requireRoles } = require('../middleware/verifyToken'); // propriedade do default

const mongoose = require('mongoose');

// Carrega Motorista (existe no seu projeto)
let Motorista;
try {
  Motorista = require('../models/Motorista');
} catch (e) {
  console.error('[driverStatusRoutes] Model Motorista não encontrado:', e?.message);
}

// Carrega Profissional (pode não existir ainda)
let Profissional = null;
try {
  Profissional = require('../models/Profissional');
} catch (_) {
  // OK: tratamos abaixo respondendo 501 se não existir
}

/* =========================
   MOTORISTA — GET status
   ========================= */
router.get(
  '/motorista/status',
  verifyToken,
  requireRoles('motorista'),
  async (req, res) => {
    try {
      if (!Motorista) {
        return res.status(500).json({ message: 'Model Motorista indisponível.' });
      }
      // Estratégia de vínculo:
      // 1) userId => preferencial (quando login é unificado)
      // 2) email  => fallback (se o cadastro do motorista usa email do usuário)
      const q = { };
      if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
        q.userId = req.user.id;
      } else if (req.user?.email) {
        q.email = String(req.user.email).toLowerCase().trim();
      }
      if (!Object.keys(q).length) {
        return res.status(400).json({ message: 'Impossível identificar motorista associado ao usuário logado.' });
      }

      const doc = await Motorista.findOne(q).select('online').lean();
      return res.json({ online: !!doc?.online });
    } catch (err) {
      console.error('[GET /motorista/status] erro:', err);
      return res.status(500).json({ message: 'Erro ao obter status.' });
    }
  }
);

/* =========================
   MOTORISTA — PATCH status
   ========================= */
router.patch(
  '/motorista/status',
  verifyToken,
  requireRoles('motorista'),
  async (req, res) => {
    try {
      if (!Motorista) {
        return res.status(500).json({ message: 'Model Motorista indisponível.' });
      }
      const { online } = req.body;
      if (typeof online !== 'boolean') {
        return res.status(400).json({ message: 'Campo "online" deve ser booleano.' });
      }

      const q = { };
      if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
        q.userId = req.user.id;
      } else if (req.user?.email) {
        q.email = String(req.user.email).toLowerCase().trim();
      }
      if (!Object.keys(q).length) {
        return res.status(400).json({ message: 'Impossível identificar motorista associado ao usuário logado.' });
      }

      const updated = await Motorista.findOneAndUpdate(
        q,
        { $set: { online } },
        { new: true, upsert: false }
      ).select('online');

      if (!updated) {
        return res.status(404).json({ message: 'Motorista não encontrado para o usuário logado.' });
      }
      return res.json({ ok: true, online: !!updated.online });
    } catch (err) {
      console.error('[PATCH /motorista/status] erro:', err);
      return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
  }
);

/* =========================
   PROFISSIONAL — GET status
   ========================= */
router.get(
  '/profissionais/status',
  verifyToken,
  requireRoles('profissional'),
  async (req, res) => {
    try {
      if (!Profissional) {
        // Evita quebrar enquanto o model não existe
        return res.status(501).json({ message: 'Model Profissional ausente. Crie models/Profissional.js com campo "online".' });
      }
      const q = { };
      if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
        q.userId = req.user.id;
      } else if (req.user?.email) {
        q.email = String(req.user.email).toLowerCase().trim();
      }
      if (!Object.keys(q).length) {
        return res.status(400).json({ message: 'Impossível identificar profissional associado ao usuário logado.' });
      }

      const doc = await Profissional.findOne(q).select('online').lean();
      return res.json({ online: !!doc?.online });
    } catch (err) {
      console.error('[GET /profissionais/status] erro:', err);
      return res.status(500).json({ message: 'Erro ao obter status.' });
    }
  }
);

/* =========================
   PROFISSIONAL — PATCH status
   ========================= */
router.patch(
  '/profissionais/status',
  verifyToken,
  requireRoles('profissional'),
  async (req, res) => {
    try {
      if (!Profissional) {
        return res.status(501).json({ message: 'Model Profissional ausente. Crie models/Profissional.js com campo "online".' });
      }
      const { online } = req.body;
      if (typeof online !== 'boolean') {
        return res.status(400).json({ message: 'Campo "online" deve ser booleano.' });
      }

      const q = { };
      if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
        q.userId = req.user.id;
      } else if (req.user?.email) {
        q.email = String(req.user.email).toLowerCase().trim();
      }
      if (!Object.keys(q).length) {
        return res.status(400).json({ message: 'Impossível identificar profissional associado ao usuário logado.' });
      }

      const updated = await Profissional.findOneAndUpdate(
        q,
        { $set: { online } },
        { new: true, upsert: false }
      ).select('online');

      if (!updated) {
        return res.status(404).json({ message: 'Profissional não encontrado para o usuário logado.' });
      }
      return res.json({ ok: true, online: !!updated.online });
    } catch (err) {
      console.error('[PATCH /profissionais/status] erro:', err);
      return res.status(500).json({ message: 'Erro ao atualizar status.' });
    }
  }
);

module.exports = router;
