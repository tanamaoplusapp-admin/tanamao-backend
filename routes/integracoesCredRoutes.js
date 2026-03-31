const express = require('express');
const IntegracaoCred = require('../models/IntegracaoCred');
const router = express.Router();

// POST /api/integracoes/cred/apikey
router.post('/cred/apikey', async (req, res) => {
  const { empresaId, provider = 'tiny', apiKey, baseUrl } = req.body || {};
  if (!empresaId || !apiKey) return res.status(400).json({ error: 'empresaId e apiKey são obrigatórios' });

  await IntegracaoCred.findOneAndUpdate(
    { empresaId, provider },
    { $set: { apiKey, baseUrl: baseUrl || null } },
    { upsert: true }
  );

  const { enqueueSyncFromProvider } = require('../services/integracoes/syncService');
  enqueueSyncFromProvider({ empresaId, provider }).catch(() => {});
  res.json({ ok: true });
});

module.exports = router;
