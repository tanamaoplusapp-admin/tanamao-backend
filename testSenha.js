require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Ajuste o caminho conforme seu projeto
const User = require('./models/user'); 

// Substitua pelo email e senha que quer testar
const EMAIL_TEST = 'marcelavieeira@gmail.com';
const SENHA_TEST = 'suaSenhaAqui!';

async function main() {
  try {
    // Conexão com MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || 'TaNaMaoPlus',
    });
    console.log('✅ Conectado ao MongoDB');

    // Procura usuário
    const user = await User.findOne({ email: EMAIL_TEST });
    if (!user) {
      console.log('❌ Usuário não encontrado');
      process.exit(1);
    }

    console.log('📄 Documento do usuário:', user);

    // Testa senha
    const hash = user.password;
    if (!hash) {
      console.log('❌ Usuário não tem senha cadastrada');
      process.exit(1);
    }

    const ok = await bcrypt.compare(SENHA_TEST, hash);
    console.log('🔑 Senha correta?', ok);

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    mongoose.connection.close();
  }
}

main();
