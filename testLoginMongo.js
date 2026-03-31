require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('./models/user');

// Conexão com MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB || 'tanamao',
    });
    console.log('✅ Conectado ao MongoDB');
  } catch (err) {
    console.error('❌ Erro ao conectar no MongoDB:', err);
    process.exit(1);
  }
}

// Função de teste de login
async function testLogin(email, password) {
  try {
    // Busca usuário incluindo a senha
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password').lean();

    if (!user) {
      console.log('❌ Usuário não encontrado');
      return;
    }

    if (!user.password) {
      console.log('❌ Usuário não tem senha cadastrada');
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (isValid) {
      console.log('✅ Senha válida! Login funcionaria.');
    } else {
      console.log('❌ Senha incorreta');
    }
  } catch (err) {
    console.error('Erro no teste de login:', err);
  }
}

// --------- EXECUÇÃO ----------
(async () => {
  await connectDB();

  // Troque para o email e senha do usuário que quer testar
  const email = 'marcelavieeira@gmail.com';
  const password = 'Zico1981!';

  await testLogin(email, password);
  process.exit(0);
})();
