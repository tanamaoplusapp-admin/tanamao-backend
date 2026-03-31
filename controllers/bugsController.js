const mongoose = require("mongoose");
const Bug = require("../models/bug");

/* ================= LIST ================= */

exports.list = async (req, res) => {
  try {
    const {
      status,
      userId,
      companyId,
      screen,
      appVersion,
      dateFrom,
      dateTo,
      q,
      limit = 200
    } = req.query;

    const cond = {};

    if (status) cond.status = status;
    if (userId) cond.userId = userId;
    if (companyId) cond.companyId = companyId;

    if (screen) cond["meta.screen"] = screen;
    if (appVersion) cond.appVersion = appVersion;

    if (dateFrom || dateTo) cond.createdAt = {};
    if (dateFrom) cond.createdAt.$gte = new Date(dateFrom);
    if (dateTo) cond.createdAt.$lte = new Date(dateTo);

    if (q) {
      cond.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { stack: { $regex: q, $options: "i" } }
      ];
    }

    const items = await Bug.find(cond)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ items });

  } catch (e) {
    console.error("[bugs.list] erro", e);
    res.status(500).json({
      message: "Falha ao listar bugs"
    });
  }
};

/* ================= GET ================= */

exports.get = async (req, res) => {
  try {
    const { id } = req.params;

    // evita crash quando /bugs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido"
      });
    }

    const bug = await Bug.findById(id).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado"
      });
    }

    res.json(bug);

  } catch (e) {
    console.error("[bugs.get] erro", e);
    res.status(500).json({
      message: "Falha ao obter bug"
    });
  }
};

/* ================= COUNT ================= */

exports.countOpen = async (_req, res) => {
  try {
    const count = await Bug.countDocuments({
      status: { $in: ["aberto", "triagem", "em_andamento"] }
    });

    res.json({ count });

  } catch (e) {
    console.error("[bugs.countOpen] erro", e);
    res.status(500).json({
      message: "Falha ao contar bugs"
    });
  }
};

/* ================= START ================= */

exports.start = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido"
      });
    }

    const bug = await Bug.findByIdAndUpdate(
      id,
      { status: "em_andamento" },
      { new: true }
    ).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado"
      });
    }

    res.json(bug);

  } catch (e) {
    console.error("[bugs.start] erro", e);
    res.status(500).json({
      message: "Falha ao atualizar bug"
    });
  }
};

/* ================= RESOLVE ================= */

exports.resolve = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido"
      });
    }

    const bug = await Bug.findByIdAndUpdate(
      id,
      { status: "resolvido" },
      { new: true }
    ).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado"
      });
    }

    res.json(bug);

  } catch (e) {
    console.error("[bugs.resolve] erro", e);
    res.status(500).json({
      message: "Falha ao atualizar bug"
    });
  }
};

/* ================= REOPEN ================= */

exports.reopen = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido"
      });
    }

    const bug = await Bug.findByIdAndUpdate(
      id,
      { status: "aberto" },
      { new: true }
    ).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado"
      });
    }

    res.json(bug);

  } catch (e) {
    console.error("[bugs.reopen] erro", e);
    res.status(500).json({
      message: "Falha ao atualizar bug"
    });
  }
};

/* ================= LOGS ================= */

exports.logs = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID inválido"
      });
    }

    const bug = await Bug.findById(id).lean();

    if (!bug) {
      return res.status(404).json({
        message: "Bug não encontrado"
      });
    }

    res.json({
      stack: bug.stack || "Sem stack",
      context: bug.meta || {},
      device: bug.device,
      platform: bug.platform,
      version: bug.appVersion
    });

  } catch (e) {
    console.error("[bugs.logs] erro", e);
    res.status(500).json({
      message: "Falha ao obter logs"
    });
  }
};

/* ================= REPORT ================= */

exports.report = async (req, res) => {
  try {
    const {
      title,
      description,
      severity,
      appVersion,
      platform,
      device,
      stack,
      meta
    } = req.body || {};

    if (!title) {
      return res.status(400).json({
        message: "title é obrigatório"
      });
    }

    const doc = new Bug({
      title: String(title).trim(),
      description: String(description || "").trim(),
      severity: severity || "médio",
      appVersion,
      platform,
      device,
      stack,
      meta
    });

    if (req.user?._id) {
      const role = (req.user.role || "").toLowerCase();

      if (role === "empresa") {
        doc.companyId = req.user._id;
      } else {
        doc.userId = req.user._id;
      }
    }

    const saved = await doc.save();

    res.status(201).json(saved);

  } catch (e) {
    console.error("[bugs.report] erro", e);
    res.status(500).json({
      message: "Falha ao reportar bug"
    });
  }
};