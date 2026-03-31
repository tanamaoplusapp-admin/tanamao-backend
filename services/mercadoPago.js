// services/mercadoPago.js
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const config = require('../config/env'); // loader central de envs

function resolveAccessToken() {
  return (
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    (config.mercadoPago && config.mercadoPago.accessToken) ||
    config.mpAccessToken ||
    ''
  );
}

const accessToken = resolveAccessToken();

if (!accessToken) {
  console.warn('[mercadoPago] MERCADO_PAGO_ACCESS_TOKEN ausente. Pagamentos podem falhar.');
}

// Instância única do SDK
const mp = new MercadoPagoConfig({
  accessToken,
  options: {
    timeout: Number(process.env.MP_HTTP_TIMEOUT_MS || 10000), // opcional
  },
});

/* Helpers convenientes (opcionais) */
const createPayment = (body, idempotencyKey) =>
  new Payment(mp).create({
    body,
    requestOptions: idempotencyKey ? { idempotencyKey } : undefined,
  });

const getPayment = (id) => new Payment(mp).get({ id });

const createPreference = (body) => new Preference(mp).create({ body });

module.exports = {
  mp,
  Payment,
  Preference,
  createPayment,
  getPayment,
  createPreference,
};
