const PagamentoMensalidade = require('../models/PagamentoMensalidade');
const User = require('../models/user');
const Profissional = require('../models/Profissional'); // legado / compat

/**
 * RESUMO FINANCEIRO REAL (ADMIN)
 * Fonte da verdade: User.subscriptionStatus + trialEndsAt
 */
exports.resumoMensalidades = async (req, res) => {
  try {
    const hoje = new Date();

    // ==============================
    // NOVA LÓGICA — ESTADO REAL
    // ==============================
    const emTrial = await User.countDocuments({
      subscriptionStatus: 'trial',
      trialEndsAt: { $gte: hoje },
    });

    const ativos = await User.countDocuments({
      subscriptionStatus: 'active',
    });

    const inadimplentes = await User.countDocuments({
      subscriptionStatus: 'overdue',
    });

    // ==============================
    // MÉTRICAS LEGADAS (MANTIDAS)
    // ==============================
    const mensalidadesAtrasadas = await PagamentoMensalidade.countDocuments({
      vencimento: { $lt: hoje },
      status: { $ne: 'pago' },
    });

    const mensalidadesPagas = await PagamentoMensalidade.countDocuments({
      status: 'pago',
    });

    res.json({
      ok: true,
      data: {
        // 🔹 NOVO (REAL)
        emTrial,
        ativos,
        inadimplentes,

        // 🔹 LEGADO (mantido)
        mensalidadesAtrasadas,
        mensalidadesPagas,
      },
    });
  } catch (e) {
    console.error('centralMensalidade.resumo:', e);
    res.status(500).json({
      ok: false,
      message: 'Erro ao gerar resumo de mensalidades',
    });
  }
};

/**
 * LISTA DETALHADA DAS MENSALIDADES ATRASADAS
 * (LEGADO — mantido por compatibilidade)
 */
exports.listAtrasadas = async (req, res) => {
  try {
    const hoje = new Date();

    const atrasadas = await PagamentoMensalidade.find({
      vencimento: { $lt: hoje },
      status: { $ne: 'pago' },
    })
      .sort({ vencimento: 1 })
      .limit(100)
      .populate('user', 'name email role')
      .lean();

    const enriched = atrasadas.map(m => ({
      _id: m._id,
      user: m.user
        ? {
            _id: m.user._id,
            name: m.user.name,
            email: m.user.email,
            role: m.user.role,
          }
        : null,
      valor: m.valor,
      status: m.status,
      vencimento: m.vencimento,
      criadoEm: m.createdAt,
      atualizadoEm: m.updatedAt,
    }));

    res.json({
      ok: true,
      total: enriched.length,
      data: enriched,
    });
  } catch (e) {
    console.error('centralMensalidade.listAtrasadas:', e);
    res.status(500).json({
      ok: false,
      message: 'Erro ao listar mensalidades atrasadas',
    });
  }
};
