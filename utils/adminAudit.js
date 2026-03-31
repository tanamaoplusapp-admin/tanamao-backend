const AdminAuditLog = require("../models/AdminAuditLog");

module.exports = async function logAdminAction({
  adminId,
  action,
  targetType,
  targetId,
  metadata = {},
  req,
}) {
  try {
    await AdminAuditLog.create({
      adminId,
      action,
      targetType,
      targetId,
      metadata,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    console.error("AUDIT LOG ERROR:", err);
  }
};
