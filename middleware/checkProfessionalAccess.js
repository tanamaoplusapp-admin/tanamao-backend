module.exports = function checkProfessionalAccess(req, res, next) {
  try {

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Não autenticado"
      });
    }

    // bloqueado manualmente
    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Usuário bloqueado pelo administrador"
      });
    }

    // bloqueio financeiro
    if (
      user.subscriptionStatus === "overdue" ||
      user.subscriptionStatus === "blocked"
    ) {
      return res.status(403).json({
        message: "Assinatura vencida. Regularize para continuar."
      });
    }

    next();

  } catch (e) {
    console.error("checkProfessionalAccess", e);
    res.status(500).json({
      message: "Erro interno"
    });
  }
};