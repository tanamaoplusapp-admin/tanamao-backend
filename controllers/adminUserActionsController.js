const User = require("../models/user");
const logAdminAction = require("../utils/adminAudit");

// ================================
// FINANCEIRO (JÁ FUNCIONANDO)
// ================================
const updateFinancialStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, trialEndsAt } = req.body;

    const adminId = req.user._id;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const metadata = {
      previousStatus: user.subscriptionStatus,
      previousTrialEndsAt: user.trialEndsAt,
    };

    switch (action) {
      case "block":
        user.subscriptionStatus = "overdue";
        break;

      case "activate":
        user.subscriptionStatus = "active";
        break;

      case "mark-overdue":
        user.subscriptionStatus = "overdue";
        break;

      case "extend-trial":
        if (!trialEndsAt) {
          return res.status(400).json({ message: "trialEndsAt é obrigatório" });
        }
        user.subscriptionStatus = "trial";
        user.trialEndsAt = new Date(trialEndsAt);
        break;

      default:
        return res.status(400).json({ message: "Ação inválida" });
    }

    await user.save();

    await logAdminAction({
      adminId,
      action,
      targetType: "user",
      targetId: user._id,
      metadata,
      req,
    });

    res.json({
      ok: true,
      user: {
        id: user._id,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("adminUserActions.updateFinancialStatus:", err);
    res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
};

// ================================
// STATUS DO USUÁRIO (ADMIN)
// ================================
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const adminId = req.user._id;

    if (!status) {
      return res.status(400).json({ message: "Status é obrigatório" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const metadata = {
      previousStatus: user.status,
    };

    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Status inválido" });
    }

    user.status = status;
    await user.save();

    await logAdminAction({
      adminId,
      action: `user-status-${status}`,
      targetType: "user",
      targetId: user._id,
      metadata,
      req,
    });

    res.json({
      ok: true,
      user: {
        id: user._id,
        status: user.status,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("adminUserActions.updateUserStatus:", err);
    res.status(500).json({ message: "Erro ao atualizar status do usuário" });
  }
};

// ================================
// DOCUMENTOS DO USUÁRIO (NOVO)
// ================================
const updateUserDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { document, status, reason } = req.body;

    const adminId = req.user._id;

    if (!document || !status) {
      return res.status(400).json({
        message: "Documento e status são obrigatórios",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status inválido" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (!user.documents) {
      user.documents = {};
    }

    const previousDocument = user.documents[document] || {};

    user.documents[document] = {
      ...previousDocument,
      status,
      reason: status === "rejected" ? reason || null : null,
      reviewedAt: new Date(),
      reviewedBy: adminId,
    };

    /* ================================
       REGRA AUTOMÁTICA DE DOCUMENTOS
    ================================= */

    const REQUIRED_DOCS_BY_ROLE = {
      motorista: ["cnh", "vehicle"],
      profissional: ["identity"], // certificado opcional
      empresa: ["cnpj", "contratoSocial"],
    };

    const requiredDocs = REQUIRED_DOCS_BY_ROLE[user.role] || [];

    const hasRejected = requiredDocs.some(
      (key) => user.documents[key]?.status === "rejected"
    );

    const allApproved =
      requiredDocs.length > 0 &&
      requiredDocs.every(
        (key) => user.documents[key]?.status === "approved"
      );

    // 🔹 ADIÇÃO: STATUS DE CADASTRO (SEM REMOVER status ATUAL)
    if (hasRejected) {
      user.statusCadastro = "reprovado";
    } else if (allApproved) {
      user.statusCadastro = "aprovado";
    } else {
      user.statusCadastro = "incompleto";
    }

    await user.save();

    await logAdminAction({
      adminId,
      action: `document-${document}-${status}`,
      targetType: "user",
      targetId: user._id,
      metadata: {
        document,
        previousStatus: previousDocument.status || null,
        newStatus: status,
      },
      req,
    });

    return res.json({
      ok: true,
      user,
    });
  } catch (err) {
    console.error(
      "adminUserActions.updateUserDocumentStatus:",
      err
    );
    return res
      .status(500)
      .json({ message: "Erro ao atualizar documento" });
  }
};

module.exports = {
  updateFinancialStatus,
  updateUserStatus,
  updateUserDocumentStatus,
};
