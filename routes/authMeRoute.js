const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { verifyToken } = require("../middleware/verifyToken");

// 🔐 Retorna usuário autenticado
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Token inválido" });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json({ user });
  } catch (err) {
    console.error("[auth/me]", err);
    return res.status(500).json({ message: "Erro ao validar sessão" });
  }
});

module.exports = router;
