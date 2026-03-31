const bcrypt = require('bcryptjs');

const senhaDigitada = 'Zico1981!';
const hashDoMongo = '$2a$10$yhjAcWWRcStq6mn6jOG07ORmGcUNQlgDalNO4yxoNPIWDL8F8n3wK';

bcrypt.compare(senhaDigitada, hashDoMongo)
  .then(ok => {
    if (ok) console.log('✅ Senha válida! Login funcionaria.');
    else console.log('❌ Senha inválida! Algo não bate.');
  })
  .catch(err => console.error('Erro no bcrypt.compare:', err));
