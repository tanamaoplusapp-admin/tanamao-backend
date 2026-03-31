require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/user'); // caminho relativo correto

async function main() {
  try {
    // Conecta ao Mongo usando a URI que o backend usa
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado ao MongoDB');

    const email = 'marcelavieeira@gmail.com';
    const password = 'Zico1981!';

    const emailNorm = email.toLowerCase().trim();
    const user = await User.findOne({ email: emailNorm }).lean();

    if (!user) {
      console.log('❌ Usuário não encontrado no Mongo remoto');
      process.exit(1);
    }

    console.log('📄 Documento do usuário:', user);

    if (!user.password) {
      console.log('❌ Usuário não tem senha cadastrada');
      process.exit(1);
    }

    const ok = await bcrypt.compare(password, user.password);
    if (ok) {
      console.log('✅ Senha válida! Login funcionaria.');
    } else {
      console.log('❌ Senha inválida!');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

main();
