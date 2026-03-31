// cron/checkExpiredPix.js
require('dotenv').config();
const cron = require('node-cron');


const Order = require('../models/order');

/**
 * Regra:
 * - Considera pedidos com pagamento PIX: pagamento.metodo === 'pix'
 * - Status de pagamento ainda pendente: pagamento.status ∈ ['pending', 'in_process']
 * - Criados nas últimas N horas (PIX_LOOKBACK_HOURS, padrão 48h)
 * - Expiração: usa pagamento.expiration_time (se existir) ou TTL em minutos (PIX_TTL_MINUTES, padrão 30)
 * - Se expirado -> set pagamento.status = 'expired'
 */
async function runPixSweep() {
  try {
    const now = Date.now();
    const lookbackHours = Number(process.env.PIX_LOOKBACK_HOURS || 48);
    const since = new Date(now - lookbackHours * 60 * 60 * 1000);
    const ttlMin = Number(process.env.PIX_TTL_MINUTES || 30);

    // ✅ Usamos aggregation para evitar qualquer ambiguidade de cast.
    const pendentes = await Order.aggregate([
      {
        $match: {
          'pagamento.metodo': 'pix',
          'pagamento.status': { $in: ['pending', 'in_process'] },
          createdAt: { $gte: since },
        },
      },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          'pagamento.expiration_time': 1,
          'pagamento.status': 1,
        },
      },
    ]);

    if (!Array.isArray(pendentes) || pendentes.length === 0) {
      return;
    }

    const idsParaExpirar = [];
    const nowDate = new Date();

    for (const o of pendentes) {
      const createdAt = o.createdAt ? new Date(o.createdAt) : null;
      const expirationTime = o?.pagamento?.expiration_time
        ? new Date(o.pagamento.expiration_time)
        : null;

      // regra de expiração:
      let expiresAt;
      if (expirationTime && !isNaN(expirationTime.getTime())) {
        expiresAt = expirationTime;
      } else if (createdAt && !isNaN(createdAt.getTime())) {
        expiresAt = new Date(createdAt.getTime() + ttlMin * 60000);
      }

      if (expiresAt && expiresAt <= nowDate) {
        idsParaExpirar.push(o._id);
      }
    }

    if (idsParaExpirar.length > 0) {
      // marca como expirado apenas se ainda está pendente/in_process
      await Order.updateMany(
        { _id: { $in: idsParaExpirar }, 'pagamento.status': { $in: ['pending', 'in_process'] } },
        { $set: { 'pagamento.status': 'expired' } }
      );
      console.log(`[CRON] PIX: expirados ${idsParaExpirar.length} pedido(s).`);
    }
  } catch (err) {
    console.error('[CRON] Erro na execução do cron PIX', err);
  }
}

function startPixCron() {
  const everyMinutes = Number(process.env.PIX_CRON_EVERY_MINUTES || 5);

  // executa na subida
  runPixSweep();

  // agenda a cada N minutos
  cron.schedule(`*/${everyMinutes} * * * *`, runPixSweep, {
    timezone: process.env.CRON_TZ || 'America/Campo_Grande',
  });

  console.log(`[CRON] PIX agendado para cada ${everyMinutes} minuto(s).`);
}

module.exports = { startPixCron };
