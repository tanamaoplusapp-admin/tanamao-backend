const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const verifyToken = auth.verifyToken || auth;
const requireRoles = auth.requireRoles
  ? auth.requireRoles("admin")
  : (_req,_res,next)=>next();

const AdminAuditLog = require("../models/AdminAuditLog");

router.get(
  "/audit",
  verifyToken,
  requireRoles,
  async (req, res) => {
    try {
      const limit = Math.min(
        Number(req.query.limit || 50),
        200
      );

      const logs = await AdminAuditLog.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("adminId", "name email")
        .lean();

      res.json({
        ok: true,
        data: logs
      });

    } catch (err) {
      console.error("admin audit error", err);

      res.status(500).json({
        ok: false,
        message: "Erro ao buscar auditoria"
      });
    }
  }
);

module.exports = router;