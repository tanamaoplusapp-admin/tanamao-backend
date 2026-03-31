// =============================
// middleware/verifyHmac.js
// =============================
const crypto = require('crypto');
let Integration;
try {
  Integration = require('../models/IntegracaoCred');
} catch (_) {
  // fallback caso o arquivo tenha nome diferente no projeto
  try { Integration = require('./models/integracaoCred'); } catch (_) {}
}

module.exports = async function verifyHmac(req, res, next) {
  try {
    const companyId = req.header('X-Company');
    const signature = req.header('X-Signature');
    if (!companyId || !signature) {
      return res.status(401).json({ error: 'missing headers: X-Company and X-Signature' });
    }

    // Busca secret específico da empresa (ou fallback de env)
    const integ = Integration ? await Integration.findOne({ empresaId: companyId }).lean() : null;
    const secret = (integ && integ.secret) || process.env.DEFAULT_INTEGRATION_SECRET;
    if (!secret) return res.status(401).json({ error: 'integration secret not configured' });

    const payload = JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected !== signature) return res.status(401).json({ error: 'invalid signature' });

    req.integration = { empresaId: companyId, provider: integ?.provider };
    return next();
  } catch (err) {
    console.error('verifyHmac error', err);
    return res.status(500).json({ error: 'verifyHmac failed' });
  }
};
