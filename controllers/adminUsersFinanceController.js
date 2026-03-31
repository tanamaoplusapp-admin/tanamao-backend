// controllers/adminUsersFinanceController.js

/**
 * LISTA FINANCEIRA DE TODOS OS USUÁRIOS
 * GET /api/admin/users/finance
 */
exports.listUsersFinance = async (req, res) => {
  try {
    res.json({
      ok: true,
      items: [],
    });
  } catch (err) {
    console.error('[adminUsersFinance] listUsersFinance', err);
    res.status(500).json({ error: 'Erro ao listar financeiro dos usuários' });
  }
};

/**
 * FINANCEIRO DE UM USUÁRIO ESPECÍFICO
 * GET /api/admin/users/:id/finance
 */
exports.getUserFinance = async (req, res) => {
  try {
    const { id } = req.params;

    res.json({
      ok: true,
      userId: id,
      finance: {},
    });
  } catch (err) {
    console.error('[adminUsersFinance] getUserFinance', err);
    res.status(500).json({ error: 'Erro ao buscar financeiro do usuário' });
  }
};
