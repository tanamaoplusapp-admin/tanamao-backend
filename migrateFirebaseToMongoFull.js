// migrateFirebaseToMongoFull.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');

// Models do Mongo
const User = require('./models/user'); // ajuste se necessário
const Profissional = require('./models/Profissional');

// Firebase
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Config Mongo
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI não configurado no .env');

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Conectado ao MongoDB'))
  .catch(err => { console.error(err); process.exit(1); });

// Helpers
const hashPassword = async (pwd = '123456') => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pwd, salt);
};

const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');
const defaultStatus = { online: false, operationalStatus: 'disponivel' };

(async () => {
  try {
    const usersSnapshot = await db.collection('profissionais').get();
    console.log(`🔹 ${usersSnapshot.size} profissionais encontrados no Firebase`);

    for (const doc of usersSnapshot.docs) {
      const fbData = doc.data();

      // --- 1) Criar ou atualizar User ---
      let user = await User.findOne({ email: fbData.email });
      const password = fbData.password ? await hashPassword(fbData.password) : await hashPassword('123456');
      if (!user) {
        user = await User.create({
          name: fbData.name || fbData.fullName || 'Profissional',
          email: fbData.email,
          password,
          phone: onlyDigits(fbData.phone || fbData.telefone || ''),
          role: 'profissional',
          active: true,
        });
        console.log(`🟢 User criado: ${user.email}`);
      } else {
        console.log(`⚪ User já existe: ${user.email}`);
      }

      // --- 2) Criar ou atualizar Profissional ---
      let prof = await Profissional.findOne({ userId: user._id });
      const operationalStatus = fbData.operationalStatus || fbData.status || defaultStatus.operationalStatus;
      const online = typeof fbData.online === 'boolean' ? fbData.online : defaultStatus.online;
      const especialidades = Array.isArray(fbData.especialidades) ? fbData.especialidades : [];
      const fotos = Array.isArray(fbData.fotos) ? fbData.fotos : [];

      if (!prof) {
        prof = await Profissional.create({
          userId: user._id,
          name: user.name,
          email: user.email,
          password: user.password,
          cpf: onlyDigits(fbData.cpf || ''),
          phone: user.phone,
          address: fbData.address || '',
          especialidades,
          fotoPerfil: fbData.fotoPerfil || null,
          fotos,
          online,
          operationalStatus,
          statusCadastro: fbData.statusCadastro || 'incompleto',
          status: fbData.status || 'pendente',
          aprovado: fbData.aprovado ?? false,
        });
        console.log(`🟢 Profissional criado: ${prof.name}`);
      } else {
        // Atualiza campos importantes
        prof.name = user.name;
        prof.phone = user.phone;
        prof.email = user.email;
        prof.operationalStatus = operationalStatus;
        prof.online = online;
        prof.fotoPerfil = fbData.fotoPerfil || prof.fotoPerfil;
        prof.fotos = fotos.length ? fotos : prof.fotos;
        prof.especialidades = especialidades.length ? especialidades : prof.especialidades;
        prof.statusCadastro = fbData.statusCadastro || prof.statusCadastro;
        prof.status = fbData.status || prof.status;
        prof.aprovado = fbData.aprovado ?? prof.aprovado;
        await prof.save();
        console.log(`🔄 Profissional atualizado: ${prof.name}`);
      }
    }

    console.log('✅ Migração COMPLETA!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração:', err);
    process.exit(1);
  }
})();
