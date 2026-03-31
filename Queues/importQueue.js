const Queue = require('bull');
const connection = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const importQueue = new Queue('import-queue', connection);
module.exports = { importQueue };
