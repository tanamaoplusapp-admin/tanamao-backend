const Bug = require("../models/bug");

function normalizeSeverity(value) {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    low: "baixo",
    baixo: "baixo",
    baixa: "baixo",

    medium: "médio",
    medio: "médio",
    media: "médio",
    média: "médio",
    médio: "médio",

    high: "alto",
    alta: "alto",
    alto: "alto",

    critical: "crítico",
    critico: "crítico",
    crítico: "crítico",
  };

  return map[raw] || "médio";
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    open: "aberto",
    opened: "aberto",
    aberto: "aberto",

    triage: "triagem",
    triagem: "triagem",

    in_progress: "em_andamento",
    andamento: "em_andamento",
    em_andamento: "em_andamento",

    resolved: "resolvido",
    resolvido: "resolvido",

    closed: "fechado",
    fechado: "fechado",
  };

  return map[raw] || "aberto";
}

function buildTitle(payload = {}) {
  return String(
    payload.title ||
    payload.type ||
    payload.name ||
    payload.code ||
    "Erro não identificado"
  ).trim().slice(0, 160);
}

function buildDescription(payload = {}) {
  return String(
    payload.description ||
    payload.message ||
    ""
  ).trim();
}

module.exports = async function reportBug(payload = {}) {
  try {
    const doc = new Bug({
      title: buildTitle(payload),
      description: buildDescription(payload),
      severity: normalizeSeverity(payload.severity),
      status: normalizeStatus(payload.status),
      appVersion: payload.appVersion,
      platform: payload.platform,
      device: payload.device,
      stack: payload.stack,
      meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
    });

    const saved = await doc.save();
    return saved;
  } catch (err) {
    console.error("[reportBug] falha ao salvar bug:", err.message);
    return null;
  }
};