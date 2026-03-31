// services/mensalidadeService.js
const { MercadoPagoConfig, Payment } = require('mercadopago');
const User = require('../models/user');
const PagamentoMensalidade = require('../models/PagamentoMensalidade');
const config = require('../config/env');

const ACCESS_TOKEN =
  process.env.MERCADO_PAGO_ACCESS_TOKEN ||
  config.mercadoPago?.accessToken ||
  config.mpAccessToken ||
  '';

const mp = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });

// ---------- Helpers ----------
const normalizeRole = (r) => {
  const s = String(r || '').toLowerCase();
  if (['empresa', 'company'].includes(s)) return 'empresa';
  if (['profissional', 'pro'].includes(s)) return 'profissional';
  if (['motorista', 'driver'].includes(s)) return 'motorista';
  return 'cliente';
};

const now = () => new Date();
const monthRange = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0); // [start, end)
  return { start, end };
};

const competenciaKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const idemKey = (userId, comp = competenciaKey()) =>
  `mensalidade-${String(userId)}-${comp}`;

const asMoney = (n) => Number((Number(n) || 0).toFixed(2));

// ---------- Regras de preço / isenção ----------
function calcularMensalidade(user) {
  const role = normalizeRole(user.role || user.tipo);
  const fees = config?.payments?.monthlyFee || {};
  if (role === 'empresapequena')      return asMoney(fees.empresapequena ?? 99.99);
  if (role === 'empresamedia')      return asMoney(fees.empresamedia ?? 149.99);
  if (role === 'empresagrande')      return asMoney(fees.empresagrande ?? 249.99);
  if (role === 'profissional') return asMoney(fees.profissional ?? 99.99);
  if (role === 'motorista')    return asMoney(fees.motorista ?? 129.99);
  return 0; // cliente não paga
}

function isIsentoMensalidade(user) {
  const FREE_MONTHS = Number(process.env.MONTHLY_FREE_MONTHS || 2);
  const created = new Date(user.createdAt || user._id.getTimestamp?.() || Date.now());
  const today = now();
  const diffMonths =
    (today.getFullYear() - created.getFullYear()) * 12 +
    (today.getMonth() - created.getMonth());
  return diffMonths < FREE_MONTHS;
}

// ---------- Core ----------
async function gerarPagamentoMensalidade(userArg, metodo = 'pix') {
  if (!ACCESS_TOKEN) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN ausente na configuração.');
  }

  // Em algumas rotas você envia req.user “enxuto”; garantimos consistência
  const user = userArg || {};
  user._id = user._id || user.id;
  user.role = user.role || user.tipo || 'cliente';

  const role = normalizeRole(user.role);
  if (role === 'cliente') {
    return { status: 'isento', message: 'Cliente não paga mensalidade.', valor: 0 };
  }

  const valor = calcularMensalidade(user);
  const comp = competenciaKey();
  const { start, end } = monthRange();

  // Evita duplicidade na competência do mês (pendente/pago/isento)
  const existente = await PagamentoMensalidade.findOne({
    userId: user._id,
    status: { $in: ['pendente', 'pago', 'isento'] },
    $or: [
      { createdAt: { $gte: start, $lt: end } }, // modelos com timestamps
      { criadoEm: { $gte: start, $lt: end } },  // compat com esquema antigo
    ],
  }).lean();

  if (existente) {
    // retorna o que já existe
    return {
      status: existente.status,
      paymentId: existente.paymentId || null,
      valor: existente.valor || valor,
      qr_code: existente.qr_code || null,
      qr_code_base64: existente.qr_code_base64 || null,
      message:
        existente.status === 'pago'
          ? 'Mensalidade já paga nesta competência.'
          : existente.status === 'isento'
          ? 'Período de isenção ativo.'
          : 'Cobrança pendente já existente para este mês.',
    };
  }

  // Isenção (período trial)
  if (isIsentoMensalidade(user)) {
    await PagamentoMensalidade.create({
      userId: user._id,
      tipoUsuario: role,
      valor: 0,
      metodo,
      status: 'isento',
      // compat: ambos campos de data
      dueAt: start,
      criadoEm: now(),
    });

    return {
      status: 'isento',
      message: 'Usuário está no período de isenção.',
      valor: 0,
    };
  }

  // Somente PIX neste fluxo (cartão/boleto exigem dados extras)
  const payment_method_id = metodo === 'pix' ? 'pix' : 'pix';

  const payerName = user.name || user.nome || 'Usuário';
  const description = `Mensalidade ${role} - ${config.appName || 'Tá na Mão+'}`;
  const idempotencyKey = idemKey(user._id, comp);

  try {
    const payment = await new Payment(mp).create({
      body: {
        transaction_amount: valor,
        description,
        payment_method_id,
        payer: {
          email: user.email,
          first_name: payerName,
        },
        statement_descriptor: (process.env.MP_STATEMENT_DESCRIPTOR || 'TANAMAO+').slice(0, 22),
        notification_url: process.env.MP_WEBHOOK_URL || undefined,
        metadata: {
          userId: String(user._id),
          role,
          competencia: comp,
          mensalidade: true,
        },
      },
      requestOptions: { idempotencyKey },
    });

    // Guarda cobrança
    const tx = payment?.point_of_interaction?.transaction_data;
    const doc = await PagamentoMensalidade.create({
      userId: user._id,
      tipoUsuario: role,
      valor,
      metodo: payment_method_id,
      status: 'pendente',
      paymentId: payment.id,
      idempotencyKey,
      currency: payment.currency_id || 'BRL',
      dueAt: start,
      qr_code: tx?.qr_code || null,
      qr_code_base64: tx?.qr_code_base64 || null,
    });

    return {
      status: 'pendente',
      paymentId: payment.id,
      valor: doc.valor,
      qr_code: doc.qr_code,
      qr_code_base64: doc.qr_code_base64,
    };
  } catch (err) {
    console.error('Erro ao gerar pagamento de mensalidade:', err?.message || err);
    throw new Error('Erro ao gerar pagamento da mensalidade');
  }
}

// Cobra todos (para cron/admin)
async function cobrarMensalidades() {
  const usuarios = await User.find({
    role: { $in: ['empresa', 'profissional', 'motorista'] },
  })
    .select('name email role createdAt porteEmpresa')
    .lean();

  for (const u of usuarios) {
    try {
      const r = await gerarPagamentoMensalidade(u, 'pix');
      console.log(
        `Mensalidade -> ${u.email}: ${r.status} ` +
          (r.valor != null ? `R$${Number(r.valor).toFixed(2)}` : '')
      );
    } catch (e) {
      console.error(`Falha ao cobrar ${u.email}:`, e.message);
    }
  }
}

module.exports = {
  gerarPagamentoMensalidade,
  calcularMensalidade,
  isIsentoMensalidade,
  cobrarMensalidades,
};
