const User = require('../models/user');

function startOf(unit) {
  const d = new Date();
  if (unit === 'day') d.setHours(0,0,0,0);
  if (unit === 'week') { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0,0,0,0); }
  if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0); }
  return d;
}

exports.usersKpis = async (_req, res) => {
  try {
    const [day, week, month] = await Promise.all(
      ['day','week','month'].map(async (u) => {
        const from = startOf(u);
        return User.countDocuments({ createdAt: { $gte: from } });
      })
    );
    res.json({ ok: true, data: { new: { day, week, month } } });
  } catch (err) {
    console.error('[adminMetrics][usersKpis]', err);
    res.status(500).json({ ok: false, message: 'Erro ao calcular KPIs', error: err.message || err });
  }
};
