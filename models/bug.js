// backend/models/bug.js
const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    /* ================= BASICO ================= */

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    severity: {
      type: String,
      enum: ["baixo", "médio", "alto", "crítico"],
      default: "médio",
    },

    status: {
      type: String,
      enum: ["aberto", "triagem", "em_andamento", "resolvido", "fechado"],
      default: "aberto",
    },

    /* ================= APP / AMBIENTE ================= */

    appVersion: { type: String },
    buildNumber: { type: String },

    platform: { type: String },
    os: { type: String },
    osVersion: { type: String },

    device: { type: String },
    deviceType: { type: String },
    deviceName: { type: String },

    manufacturer: { type: String },
    model: { type: String },

    browser: { type: String },
    ip: { type: String },
    userAgent: { type: String },

    /* ================= CONTEXTO ================= */

    source: { type: String },
    screen: { type: String },
    route: { type: String },
    endpoint: { type: String },
    type: { type: String },

    /* ================= REQUEST ================= */

    method: { type: String },
    url: { type: String },
    host: { type: String },
    origin: { type: String },
    referer: { type: String },

    request: { type: Object, default: {} },
    response: { type: Object, default: {} },

    headers: { type: Object, default: {} },

    /* ================= OCORRENCIAS ================= */

    occurrences: { type: Number, default: 1 },
    firstSeen: { type: Date },
    lastSeen: { type: Date },

    /* ================= ERROR ================= */

    message: { type: String },
    stack: { type: String },

    code: { type: String },
    errorCode: { type: String },

    exceptionName: { type: String },
    functionName: { type: String },

    fileName: { type: String },
    lineNumber: { type: Number },
    columnNumber: { type: Number },

    raw: { type: mongoose.Schema.Types.Mixed },
    log: { type: mongoose.Schema.Types.Mixed },
    payload: { type: mongoose.Schema.Types.Mixed },

    /* ================= USUARIO ================= */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },

    userEmail: { type: String },
    userName: { type: String },
    userRole: { type: String },

    /* ================= EXTRA ================= */

    metadata: { type: Object, default: {} },

    // manter meta por compatibilidade com código antigo
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

schema.index({ status: 1, createdAt: -1 });
schema.index({ severity: 1, createdAt: -1 });

schema.index({ screen: 1 });
schema.index({ source: 1 });
schema.index({ type: 1 });

schema.index({ ip: 1 });
schema.index({ platform: 1 });
schema.index({ device: 1 });

schema.index({ firstSeen: -1 });
schema.index({ lastSeen: -1 });

module.exports = mongoose.models.Bug || mongoose.model("Bug", schema);