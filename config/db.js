// config/db.js
const mongoose = require('mongoose');

// Preferências por ambiente
const autoIndex =
  process.env.MONGO_AUTO_INDEX !== undefined
    ? process.env.MONGO_AUTO_INDEX === 'true'
    : process.env.NODE_ENV !== 'production';

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);
mongoose.set('autoIndex', autoIndex);
mongoose.set(
  'debug',
  process.env.MONGO_DEBUG === 'true' && process.env.NODE_ENV !== 'production'
);

const connectDB = async () => {
  try {
    // 🔥 VOLTA AO COMPORTAMENTO ANTIGO (fonte única)
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGO_URI/MONGODB_URI não configurado.');
    }

    const conn = await mongoose.connect(uri, {
      // dbName é opcional quando já vem na URI
      dbName: process.env.MONGO_DB_NAME,

      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,

      // 🔥 AJUSTES CRÍTICOS (mantidos)
      family: 4, // força IPv4 (Windows + Atlas)
      serverSelectionTimeoutMS: 20000, // mais tempo para SRV/DNS
      socketTimeoutMS: 45000,
    });

    console.log(
      `✅ MongoDB conectado: ${conn.connection.host}/${conn.connection.name}`
    );

    const { connection } = mongoose;
    connection.on('error', (err) =>
      console.error('❌ MongoDB error:', err.message)
    );
    connection.on('disconnected', () =>
      console.warn('⚠️  MongoDB desconectado')
    );
    connection.on('reconnected', () =>
      console.log('🔄 MongoDB reconectado')
    );

    const close = async (signal = 'SIGTERM') => {
      try {
        await mongoose.connection.close();
        console.log(`👋 MongoDB conexão fechada (${signal})`);
        process.exit(0);
      } catch (err) {
        console.error('Erro ao fechar MongoDB:', err.message);
        process.exit(1);
      }
    };

    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((sig) =>
      process.once(sig, () => close(sig))
    );

    return conn;
  } catch (error) {
    console.error('❌ Erro ao conectar no MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
