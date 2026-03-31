const AuditEvent = require('../models/AuditEvent');

exports.ingest = async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    if (!events.length) return res.status(400).json({ ok: false, message: 'Nenhum evento fornecido.' });

    const enriched = events.map(e => ({
      ...e,
      user: e.user || req.user?.id || null,
      companyId: e.companyId || req.user?.companyId || null,
      sessionId: e.sessionId || req.headers['x-session-id'] || null,
      correlationId: e.correlationId || null,
      payload: e.payload || {},
    }));

    await AuditEvent.insertMany(enriched, { ordered: false });
    res.status(201).json({ ok: true, count: enriched.length });
  } catch (err) {
    console.error('[auditoria][ingest]', err);
    res.status(500).json({ ok: false, message: 'Erro ao registrar eventos.', error: err.message || err });
  }
};

exports.list = async (req, res) => {
  try {
    const { type, limit = 100, user, companyId } = req.query;
    const q = {};
    if (type) q.type = type;
    if (user) q.user = user;
    if (companyId) q.companyId = companyId;

    const items = await AuditEvent.find(q)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('user', 'name email')
      .populate('companyId', 'nome');

    res.json({ ok: true, total: items.length, data: items });
  } catch (err) {
    console.error('[auditoria][list]', err);
    res.status(500).json({ ok: false, message: 'Erro ao listar eventos.', error: err.message || err });
  }
};
