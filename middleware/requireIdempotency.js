// middleware/requireIdempotency.js  (CommonJS)
module.exports = function requireIdempotency(req, res, next) {
  try {
    const key =
      req.header('Idempotency-Key') ||
      req.header('X-Idempotency-Key') ||
      req.header('x-idempotency-key');

    if (!key) {
      return res.status(400).json({ error: 'Idempotency-Key header is required' });
    }

    req.idempotencyKey = String(key);
    return next();
  } catch (err) {
    console.error('[requireIdempotency] error', err);
    return res.status(500).json({ error: 'requireIdempotency failed' });
  }
};
