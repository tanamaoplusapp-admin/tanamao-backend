require("dotenv").config();

const mongoose = require("mongoose");

const Profissional = require("../models/Profissional");
const { updateScore } = require("../services/scoreService");

async function connect() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("✅ MongoDB conectado");
}

async function recalculateAll() {
  const profissionais = await Profissional.find({}, "_id userId name");

  console.log("");
  console.log(`Encontrados ${profissionais.length} profissionais.`);
  console.log("");

  let sucesso = 0;
  let erro = 0;

  for (const profissional of profissionais) {
    try {
      const resultado = await updateScore(profissional._id);

      console.log(
        `✔ ${profissional.name || profissional._id} → Score ${resultado.score} (${resultado.level.name})`
      );

      sucesso++;
    } catch (e) {
      console.log(
        `✖ ${profissional.name || profissional._id}`
      );

      console.log(e.message);

      erro++;
    }
  }

  console.log("");
  console.log("=================================");
  console.log("TANASCORE FINALIZADO");
  console.log("=================================");
  console.log(`Sucesso : ${sucesso}`);
  console.log(`Erros   : ${erro}`);
  console.log("=================================");
}

(async () => {
  try {
    await connect();

    await recalculateAll();

    await mongoose.disconnect();

    console.log("Banco desconectado.");
  } catch (e) {
    console.error(e);

    await mongoose.disconnect();

    process.exit(1);
  }
})();