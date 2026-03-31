require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/user");

async function resetAdminPassword() {
  try {
    const mongoUri =
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.DATABASE_URL;

    if (!mongoUri) {
      throw new Error("Mongo URI não encontrada no .env");
    }

    console.log("🔌 Conectando ao MongoDB...");
    await mongoose.connect(mongoUri);

    console.log("🔐 Gerando hash...");
    const hash = await bcrypt.hash("Bh27em2019", 10);

    console.log("✍ Atualizando usuário...");
    const result = await User.updateOne(
      { email: "marcela@tanamao.com" },
      { password: hash }
    );

    console.log("✅ Senha resetada com sucesso:", result);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  }
}

resetAdminPassword();
