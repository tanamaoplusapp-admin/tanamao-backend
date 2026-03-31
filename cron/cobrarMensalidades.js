// backend/cron/cobrarMensalidades.js
const cron = require('node-cron');
const { cobrarMensalidades } = require('../services/mensalidadeService');

// ✅ Agendar para todo dia 5 às 07:00 da manhã
cron.schedule('0 7 5 * *', async () => {
  console.log('🕖 Executando cobrança automática de mensalidades (dia 5 - 07:00)...');
  try {
    await cobrarMensalidades();
    console.log('✅ Cobranças executadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar cobrança agendada:', error.message);
  }
});
