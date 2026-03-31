// config/env.js
require('dotenv').config();

const def  = (v, d) => (v === undefined || v === null || String(v).trim() === '' ? d : v);
const num  = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const bool = (v, d = false) => {
  if (v === undefined || v === null) return d;
  const s = String(v).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(s);
};
const list = (v, d = []) => (!v ? d : String(v).split(',').map(s => s.trim()).filter(Boolean));
const firstNonEmpty = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== '');

function must(name, altName) {
  const val = firstNonEmpty(process.env[name], altName ? process.env[altName] : undefined);
  if (!val || String(val).trim() === '') {
    throw new Error(`Env faltando: ${name}${altName ? ` (ou ${altName})` : ''}`);
  }
  return val;
}

const isProd = process.env.NODE_ENV === 'production';

const FRONTEND_URL     = process.env.FRONTEND_URL;
const APP_BASE_URL     = process.env.APP_BASE_URL;
const CORS_ALLOWED     = process.env.CORS_ALLOWED_ORIGINS;
const CORS_ORIGINS     = process.env.CORS_ORIGINS;

const config = {
  appName: def(process.env.APP_NAME, 'TaNaMaoPlus'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: num(process.env.PORT, 5000),

  /* 🔐 DB — aceita MONGODB_URI ou MONGO_URI */
  mongoUri: must('MONGODB_URI', 'MONGO_URI'),
  mongoDbName: process.env.MONGO_DB_NAME || undefined,
  jwtSecret: must('JWT_SECRET'),

  /* 🌐 Frontend/CORS */
  frontendUrl: def(FRONTEND_URL, 'http://localhost:3000'),
  allowedOrigins: [
    ...list(CORS_ALLOWED),
    ...list(CORS_ORIGINS),
    ...list(FRONTEND_URL),
    ...list(APP_BASE_URL),
  ].filter(Boolean),

  /* 🛡️ Segurança */
  security: {
    rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: num(process.env.RATE_LIMIT_MAX, 500),
    trustProxy: bool(process.env.TRUST_PROXY, true),
  },

  /* 💳 Mercado Pago */
  mercadoPago: {
    enabled: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
    accessToken: def(process.env.MERCADO_PAGO_ACCESS_TOKEN, ''),
    webhookUrl: def(process.env.MP_WEBHOOK_URL, ''),
    statementDescriptor: def(process.env.MP_STATEMENT_DESCRIPTOR, 'TANAMAO+'),
  },
  // compat
  mpAccessToken: def(process.env.MERCADO_PAGO_ACCESS_TOKEN, ''),

  /* 📧 Email (opcional por flag) */
  email: {
    enabled: bool(process.env.EMAIL_ENABLED),
    host: def(process.env.EMAIL_HOST, ''),
    port: num(process.env.EMAIL_PORT, 587),
    secure: bool(process.env.EMAIL_SECURE, false),
    user: def(process.env.EMAIL_USER, ''),
    pass: def(process.env.EMAIL_PASS, ''),
  },

  /* ☁️ Cloudinary (opcional por flag) */
  cloudinary: {
    enabled: bool(process.env.CLOUDINARY_ENABLED),
    cloudName: def(process.env.CLOUDINARY_CLOUD_NAME, ''),
    apiKey: def(process.env.CLOUDINARY_API_KEY, ''),
    apiSecret: def(process.env.CLOUDINARY_API_SECRET, ''),
  },

  /* 🔥 Firebase Admin (opcional por flag) */
  firebase: {
    enabled: bool(process.env.FIREBASE_ENABLED),
    projectId: def(process.env.FIREBASE_PROJECT_ID, ''),
    clientEmail: def(process.env.FIREBASE_CLIENT_EMAIL, ''),
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : '',
  },

  /* ⏰ Crons */
  crons: {
    enabled: bool(process.env.ENABLE_CRONS, true),
    tz: def(process.env.CRON_TZ, 'America/Campo_Grande'),
    pixSyncSchedule: def(process.env.CRON_PIX_SYNC_SCHEDULE, '*/5 * * * *'),
  },

  /* 💼 Pagamentos/Comissões */
  payments: {
    monthlyFee: {
      motorista: num(process.env.MONTHLY_FEE_MOTORISTA, 129.99),
      profissional: num(process.env.MONTHLY_FEE_PROFISSIONAL, 99.99),
      empresa: num(process.env.MONTHLY_FEE_EMPRESA, 149.99),
    },
    commission: {
      empresa: {
        mei:     num(process.env.COMMISSION_EMPRESA_MEI, 0.03),
        pequeno: num(process.env.COMMISSION_EMPRESA_PEQUENO, 0.05),
        medio:   num(process.env.COMMISSION_EMPRESA_MEDIO, 0.07),
        grande:  num(process.env.COMMISSION_EMPRESA_GRANDE, 0.10),
      },
      profissional: {
        base:           num(process.env.COMMISSION_PROFISSIONAL_BASE, 0),
        bonusThreshold: num(process.env.COMMISSION_PROFISSIONAL_BONUS_THRESHOLD, 3500),
        bonusRate:      num(process.env.COMMISSION_PROFISSIONAL_BONUS_RATE, 0.10),
      },
    },
  },

  /* 📂 Arquivos */
  files: {
    uploadsDir: def(process.env.UPLOADS_DIR, 'uploads'),
    maxUploadSizeMb: num(process.env.MAX_UPLOAD_SIZE_MB, 10),
  },

  /* 📍 Geolocalização */
  geolocation: {
    defaultRadiusKm: num(process.env.DEFAULT_SEARCH_RADIUS_KM, 500),
  },

  /* 🧮 Portes por cidade/UF (limiares + fatores) */
  porte: {
    meiMax:     num(process.env.PORTE_MEI_MAX, 75000),
    pequenaMax: num(process.env.PORTE_PEQUENA_MAX, 90000),
    mediaMax:   num(process.env.PORTE_MEDIA_MAX, 190000),
    cityFactorsJSON: def(process.env.PORTE_CITY_FACTORS_JSON, ''),
  },
};

module.exports = config;
