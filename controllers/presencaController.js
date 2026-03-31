const Presence = require('../models/Presence');

/* ============================================================================ 
 * STATUS DO PROFISSIONAL
 * ============================================================================ */
exports.getStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ ok: false, message: 'Não autenticado' });

    const record = await Presence.findOne({ actorId: userId, role: 'profissional' }).lean();
    return res.json({ ok: true, data: record || { status: 'Disponível', online: true } });
  } catch (e) {
    console.error('presenca.getStatus:', e);
    return res.status(500).json({ ok: false, message: 'Erro ao obter status' });
  }
};

exports.setStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ ok: false, message: 'Não autenticado' });

    const { status } = req.body;
    const allowed = ['Disponível', 'Em atendimento', 'Indisponível'];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, message: 'Status inválido' });

    const online = status === 'Disponível';

    const record = await Presence.findOneAndUpdate(
      { actorId: userId, role: 'profissional' },
      { online, status, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    return res.json({ ok: true, data: record });
  } catch (e) {
    console.error('presenca.setStatus:', e);
    return res.status(500).json({ ok: false, message: 'Erro ao atualizar status' });
  }
};

/* ============================================================================ 
 * POLLING
 * ============================================================================ */
exports.pollStatus = (callback, interval = 5000) => {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const record = await Presence.find({ role: 'profissional' }).lean();
      callback(record);
    } catch {}
    if (!stopped) setTimeout(tick, interval);
  };
  tick();
  return () => { stopped = true; };
};
