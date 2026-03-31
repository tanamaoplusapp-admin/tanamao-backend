const cron = require('node-cron');
const User = require('../models/user');

cron.schedule('0 * * * *', async () => {

const agora = new Date();

await User.updateMany(
{
subscriptionStatus:'active',
subscriptionExpiresAt:{ $lt: agora }
},
{
subscriptionStatus:'overdue'
}
);

console.log('✔ Assinaturas verificadas');

});