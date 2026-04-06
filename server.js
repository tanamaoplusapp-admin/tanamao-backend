require('dotenv').config({
  path: require('path').resolve(__dirname, '.env'),
});

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const http = require('http');
const { Server } = require('socket.io');

const { errors: celebrateErrors } = require('celebrate');

const config = require('./config/env');
const connectDB = require('./config/db');
const { cobrarMensalidades } = require('./services/mensalidadeService');
require('./services/firebaseAdmin');

const { verifyToken } = require('./middleware/verifyToken');

const app = express();
const PAYMENT_WEBHOOK_PATH = '/api/payment/webhook';
const mpWebhookRoutes = require('./routes/mercadoPagoWebhookRoutes');
const categoriaPrestadorRoutes = require('./routes/categoriaPrestadorRoutes');

/* =====================================================
   CONFIGURAÇÕES BÁSICAS
===================================================== */

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.disable('x-powered-by');
app.use(helmet());

/* =====================================================
   CORS
===================================================== */

const defaultOrigins = [
  ...(config.allowedOrigins || []),
  ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  process.env.FRONTEND_URL,
  process.env.APP_BASE_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://localhost:19006',
  'https://backend-tanamao.onrender.com',
].filter(Boolean);

const allowMatchers = [
  ...new Set(defaultOrigins),
  /^http:\/\/10\.0\.2\.2(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/,
  /^exp:\/\/.*/,
  /^file:\/\/.*/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    const allowed = allowMatchers.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );

    if (allowed) return cb(null, true);

    console.warn('❌ CORS bloqueado:', origin);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

app.options('*', cors());

/* =====================================================
   MIDDLEWARES GLOBAIS
===================================================== */

app.use(cookieParser());
app.use(compression());

app.post(
  PAYMENT_WEBHOOK_PATH,
  express.raw({ type: 'application/json', limit: '2mb' })
);

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(mongoSanitize());
app.use(hpp());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* =====================================================
   AVISOS
===================================================== */

if (!process.env.JWT_SECRET)
  console.warn('[server] JWT_SECRET ausente no .env');

if (!(config.mercadoPago?.accessToken || config.mpAccessToken))
  console.warn('[server] MERCADO_PAGO_ACCESS_TOKEN ausente no .env');

/* =====================================================
   RATE LIMIT
===================================================== */

app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 500),
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path === '/health' || req.path === PAYMENT_WEBHOOK_PATH,
}));

/* =====================================================
   CONEXÃO MONGO
===================================================== */

connectDB();

/* =====================================================
   UPLOADS
===================================================== */

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/* =====================================================
   HEALTH
===================================================== */

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    app: config.appName,
    env: process.env.NODE_ENV || 'development',
    ts: new Date().toISOString(),
  });
});

app.get('/', (_req, res) =>
  res.send('🚀 API Tá na Mão+ rodando e saudável!')
);

app.use((req, res, next) => {
  console.log("➡️", req.method, req.originalUrl);
  next();
});
app.use(
  PAYMENT_WEBHOOK_PATH,
  mpWebhookRoutes.router || mpWebhookRoutes
);
/* =====================================================
   ROTAS
===================================================== */

app.use('/api/categorias-prestador', categoriaPrestadorRoutes);


/* ================= ADMIN ================= */

// IMPORTS DAS ROTAS ADMIN
const adminRoutes = require('./routes/adminRoutes')
const adminOrdersRoutes = require('./routes/adminOrdersRoutes')
const adminFinanceRoutes = require('./routes/adminFinanceRoutes')
const adminUsersRoutes = require('./routes/adminUsersRoutes')
const adminBugRoutes = require('./routes/adminBugRoutes')
const adminAuditRoutes = require('./routes/adminAuditRoutes')
const supportRoutes = require("./routes/supportRoutes")
const adminCentralMensalidadeRoutes = require('./routes/adminCentralMensalidadeRoutes')

/*
IMPORTANTE:
Algumas rotas exportam:
module.exports = router

Outras exportam:
module.exports = { router }

Então usamos:
.router || rota
para funcionar com qualquer padrão
*/

// ROTAS ADMIN
app.use('/api/admin', adminRoutes.router || adminRoutes)
app.use('/api/admin', adminOrdersRoutes.router || adminOrdersRoutes)
app.use('/api/admin', adminFinanceRoutes.router || adminFinanceRoutes)
app.use('/api/admin', adminUsersRoutes.router || adminUsersRoutes)

// BUGS ADMIN
app.use('/api/admin/bugs', adminBugRoutes.router || adminBugRoutes)

// AUDITORIA ADMIN
app.use('/api/admin', adminAuditRoutes.router || adminAuditRoutes)

// SUPORTE
app.use('/api/support', supportRoutes.router || supportRoutes)

// CENTRAL DE MENSALIDADES
app.use('/api/admin', adminCentralMensalidadeRoutes.router || adminCentralMensalidadeRoutes)
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
console.log('🟢 Rota pública registrada (isolada): /api/auth');

const routes = {
  users: { path: '/api/users', module: './routes/userRoutes' },
  finance: { path: '/api/finance', module: './routes/financeRoutes' },
agenda: { path: '/api/agenda', module: './routes/agendaRoutes' },
  public: { path: '/api/public', module: './routes/publicRoutes' },
  products: { path: '/api/products', module: './routes/productRoutes' },
  orders: { path: '/api/orders', module: './routes/orderRoutes' },
  drivers: { path: '/api/drivers', module: './routes/driverRoutes' },
  servicos: { path: '/api/servicos', module: './routes/servicoRoutes' },
  companies: { path: '/api/companies', module: './routes/companyRoutes' },
  orcamentos: { path: '/api/orcamentos', module: './routes/quoteRoutes' },
  payment: { path: '/api/payment', module: './routes/paymentRoutes' },
  entregas: { path: '/api/entregas', module: './routes/entregaRoutes' },
  reviews: { path: '/api/reviews', module: './routes/reviewRoutes' },
  mensalidade: { path: '/api/mensalidade', module: './routes/mensalidadeRoutes' },
  email: { path: '/api/email', module: './routes/emailRoutes' },
  pedidos: { path: '/api/pedidos', module: './routes/pedidoRoutes' },
  avaliacoes: { path: '/api/avaliacoes', module: './routes/avaliacaoRoutes' },
  motorista: { path: '/api/motorista', module: './routes/motoristaRoutes' },
  chat: { path: '/api/chat', module: './routes/chatRoutes' },
  comparacao: { path: '/api/comparacao', module: './routes/comparacaoRoutes' },
  frete: { path: '/api/frete', module: './routes/freteRoutes' },
  upload: { path: '/api/upload', module: './routes/uploadRoutes' },
  support: { path: '/api/apoio', module: './routes/apoioRoutes' },
  promocoes: { path: '/api/promocoes', module: './routes/promocaoRoutes' },
  galeria: { path: '/api/galeria', module: './routes/galeriaRoutes' },
  profissionais: { path: '/api/profissionais', module: './routes/profissionaisRoutes' },
};

Object.values(routes).forEach(({ path, module: modPath }) => {
  try {
    const imported = require(modPath);

    let router = null;

    // export padrão: module.exports = router
    if (typeof imported === "function") {
      router = imported;
    }

    // export { router }
    else if (imported?.router) {
      router = imported.router;
    }

    // export default
    else if (imported?.default) {
      router = imported.default;
    }

    // se não for router, ignora
    if (!router) {
      console.log("❌ Rota inválida ignorada:", path);
      return;
    }

    app.use(path, router);

    console.log("✅ rota:", path);

  } catch (err) {
    console.error("❌ erro rota:", path, err.message);
  }
});
const privacyRoutes = require('./routes/privacy');
app.use('/', privacyRoutes);


/* =====================================================
   CRONS
===================================================== */

cron.schedule('0 7 5 * *', async () => {
  try { await cobrarMensalidades(); }
  catch (e) { console.error('❌ Erro ao cobrar mensalidades:', e); }
}, { timezone: process.env.CRON_TZ || 'America/Sao_Paulo' });

if (process.env.ENABLE_CRONS !== 'false') {
  try { require('./cron/checkExpiredPix').startPixCron(); }
  catch (e) { console.error('❌ Falha ao iniciar cron PIX:', e); }
}

/* =====================================================
   SOCKET.IO (SEM ALTERAR ESTRUTURA)
===================================================== */

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('🟢 Socket conectado:', socket.id);

  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`📡 Usuário entrou na sala: ${userId}`);
    }
  });

  /* ==============================
     ENTRAR NA SALA DO CHAT
  ============================== */

  socket.on('entrar_chat', (chatId) => {
    if (chatId) {
      socket.join(chatId.toString());
    }
  });

  /* ==============================
     DIGITANDO
  ============================== */

  socket.on('digitando', ({ chatId, userId }) => {
    socket.to(chatId).emit('usuario_digitando', {
      chatId,
      userId,
    });
  });

  socket.on('parou_digitando', ({ chatId, userId }) => {
    socket.to(chatId).emit('usuario_parou_digitando', {
      chatId,
      userId,
    });
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket desconectado:', socket.id);
  });
});

/* =====================================================
   START
===================================================== */

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () =>
  console.log(`🚀 ${config.appName} rodando com WebSocket na porta ${PORT}`)
);

/* =====================================================
   ERROS GLOBAIS
===================================================== */

app.use(celebrateErrors());
process.on('unhandledRejection', reason =>
  console.error('UNHANDLED REJECTION:', reason)
);
process.on('uncaughtException', err =>
  console.error('UNCAUGHT EXCEPTION:', err)
);
app.use(async (req, res, next) => {
  console.log("ROTA NÃO ENCONTRADA", req.originalUrl);

  try {
    await require('./utils/reportBug')({
      type: "route_not_found",
      severity: "medium",
      source: "backend",
      meta: {
        url: req.originalUrl,
        method: req.method
      }
    });
  } catch (e) {
    console.error("Falha ao registrar bug 404:", e.message);
  }

  res.status(404).json({
    erro: "Rota não encontrada"
  });
});

app.use(async (err, req, res, next) => {
  console.error("SERVER CRASH", err);

  try {
    await require('./utils/reportBug')({
      type: "server_crash",
      severity: "critical",
      source: "backend",
      stack: err.stack,
      message: err.message,
      meta: {
        url: req.originalUrl,
        method: req.method
      }
    });
  } catch (e) {
    console.error("Falha ao registrar crash:", e.message);
  }

  res.status(500).json({
    erro: "Erro interno"
  });
});