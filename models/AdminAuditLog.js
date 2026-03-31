const mongoose = require("mongoose");

const AdminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      required: true,
      index: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    metadata: {
      type: Object,
      default: {},
    },

    ip: {
      type: String,
    },

    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminAuditLog", AdminAuditLogSchema);
