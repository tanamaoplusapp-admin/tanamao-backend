// cron/checkCommission.js

const User = require('../models/user')

async function checkCommissionBlocks() {

  const users = await User.find({
    comissaoPendente: { $gte: 500 },
    receberServicos: true
  })

  for (const u of users) {
    u.receberServicos = false
    await u.save()
  }

}

module.exports = checkCommissionBlocks