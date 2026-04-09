const express = require('express');
const router = express.Router();

const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { celebrate, Joi, Segments } = require('celebrate');

/* =====================================================
   MIDDLEWARE
===================================================== */

const auth = require('../middleware/verifyToken');

const verifyToken = auth.verifyToken;
const requireRoles = auth.requireRoles;

const requireVerified =
  typeof auth.requireVerified === 'function'
    ? auth.requireVerified
    : (_req, _res, next) => next();

/* ===================================================== */

const Order = require('../models/order');
const Company = require('../models/company');
const config = require('../config/env');

/* =====================================================
   MERCADO PAGO
===================================================== */

if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  console.warn('[paymentRoutes] MERCADO_PAGO_ACCESS_TOKEN ausente');
}

const mp = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

/* =====================================================
   RATE LIMIT
===================================================== */

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
});

/* =====================================================
   HELPERS
===================================================== */

const mkIdemKey = (prefix = 'pix') =>
  `${prefix}-${crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex')}`;

const asNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const objectId = Joi.string().hex().length(24);

/* =====================================================
   VALIDATION PIX (CORRIGIDO)
===================================================== */

const validatePixBody = celebrate({
  [Segments.BODY]: Joi.object({
    value: Joi.number().min(0.5).required(),

    payer: Joi.object({
      email: Joi.string().email().required(),
      first_name: Joi.string().optional(),
      last_name: Joi.string().allow('', null),
    }).required(),

    description: Joi.string().allow('', null),

    products: Joi.array().optional(),

    empresaId: objectId.optional(),

    motoristaId: objectId.allow('', null),
  }),
});

/* =====================================================
   PIX
===================================================== */

const handlePix = async (req, res) => {

  try {

    const {
      value,
      payer,
      products = [],
      description,
      empresaId,
      motoristaId
    } = req.body;

    const amount = asNumber(value);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valor inválido' });
    }

    let comissao = 0;
    let valorLiquido = amount;
    let porcentagem = 0;
    let sponsor_id;

    if (empresaId) {

      const company = await Company
        .findById(empresaId)
        .select('porteEmpresa collector_id');

      if (company && company.collector_id) {

        sponsor_id = company.collector_id;

       // temporariamente sem comissão
comissao = 0;
valorLiquido = amount;
porcentagem = 0;

      }

    }

    const payment = await new Payment(mp).create({

      body: {
        transaction_amount: amount,
        payment_method_id: 'pix',
        description: description || 'Pagamento Tá na Mão',
        payer,

        application_fee: comissao || undefined,
        sponsor_id: sponsor_id || undefined,

        metadata: {
  type: req.body.tipo,
  quantidade: req.body.quantidade,
  user_id: req.userId,
  empresaId,
  comissao,
  porcentagem,
  valorLiquido
}
      },

      requestOptions: {
        idempotencyKey: mkIdemKey('pix')
      }

    });

    const tx = payment?.point_of_interaction?.transaction_data;

    if (!tx?.qr_code) {
      return res.status(502).json({
        error: 'Falha ao gerar QR Code'
      });
    }

    let order;

    if (empresaId) {

      order = await Order.create({

        clienteId: req.userId,
        empresaId,
        motoristaId: motoristaId || undefined,

        products,

        total: amount,
        formaPagamento: 'Pix',

        comissao,
        valorLiquido,

        pagamento: {
          metodo: 'pix',
          idPagamento: payment.id,
          status: payment.status,
          qr_code: tx.qr_code,
          qr_code_base64: tx.qr_code_base64
        }

      });

    }

    return res.json({

      id: payment.id,
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64,

      pedidoId: order?._id || null

    });

  } catch (err) {

    console.error('[PIX ERROR]', err);

    return res.status(500).json({
      error: 'Erro ao gerar Pix'
    });

  }

};

router.post(
  '/pix',
  verifyToken,
  requireVerified,
  requireRoles('empresa', 'profissional'),
  validatePixBody,
  handlePix
);
/* =====================================================
   COMPRAR CRÉDITOS / ACESSO
===================================================== */

router.post(
'/credits',
verifyToken,
requireVerified,
requireRoles('profissional'),
async (req,res)=>{

try{

const { pacote, plano } = req.body

let valor = 0
let quantidade = 0
let dias = 0
let type = 'credits'
let description = ''

/* =========================
PACOTES DE CRÉDITOS
========================= */

if(pacote){

switch(pacote){

case 5:
valor = 25
quantidade = 5
type = 'credits'
description = `Compra ${quantidade} créditos`
break

case 10:
valor = 50
quantidade = 10
type = 'credits'
description = `Compra ${quantidade} créditos`
break

case 20:
valor = 100
quantidade = 20
type = 'credits'
description = `Compra ${quantidade} créditos`
break

default:
return res.status(400).json({
error:'Pacote inválido'
})

}

}

/* =========================
ACESSO POR DIAS
========================= */

else if(plano){

switch(plano){

case '1_dia':
valor = 49.90
dias = 1
type = 'access'
break

case '7_dias':
valor = 79.90
dias = 7
type = 'access'
break

case '15_dias':
valor = 99.90
dias = 15
type = 'access'
break

default:
return res.status(400).json({
error:'Plano inválido'
})

}

description = `Acesso ${dias} dias Tanamão+`

}

else{

return res.status(400).json({
error:'Dados inválidos'
})

}

/* =========================
CRIAR PAGAMENTO
========================= */

const payment = await new Payment(mp).create({

body:{
transaction_amount: valor,
payment_method_id:'pix',

description,

payer:{
email:req.user.email
},

metadata:{
type,
quantidade,
dias,
user_id:req.userId
}

}

})

const tx =
payment?.point_of_interaction?.transaction_data

return res.json({

id:payment.id,
qr_code:tx.qr_code,
qr_code_base64:tx.qr_code_base64

})

}catch(e){

console.error(e)

res.status(500).json({
error:'Erro ao gerar pagamento'
})

}

}
)


/* =====================================================
   SUBSCRIPTION 30 DIAS
===================================================== */

router.post(
'/subscription',
verifyToken,


async (req,res)=>{

try{

const valor = 129.90
const dias = 30

const payment = await new Payment(mp).create({

body:{
transaction_amount: valor,
payment_method_id:'pix',

description:`Acesso ${dias} dias Tanamão+`,

payer:{
email:req.user.email
},

metadata:{
type:'subscription',
dias,
user_id:req.userId
}

}

})

const tx =
payment?.point_of_interaction?.transaction_data

return res.json({

id:payment.id,
qr_code:tx.qr_code,
qr_code_base64:tx.qr_code_base64

})

}catch(e){

console.error(e)

res.status(500).json({
error:'Erro ao gerar pagamento'
})

}

}
)
/* =====================================================
   WEBHOOK
===================================================== */

const PagamentoMensalidade = require('../models/PagamentoMensalidade');
const User = require('../models/user');
const WebhookEvent = require('../models/WebhookEvent');
const Transaction = require('../models/transaction');

router.post('/webhook', webhookLimiter, async (req, res) => {

try {

const body = req.body;

const type = body.type || body.topic;
const dataId = body.data?.id || body.id;

if(type !== 'payment'){
return res.status(200).json({ ignored:true });
}

/* =============================
BUSCAR PAGAMENTO MP
============================= */

const payment = await new Payment(mp).get({
id: dataId
});

if(!payment || !payment.id){
return res.status(200).json({ ignored:true });
}

const metadata = payment.metadata || {};
const status = payment.status;

/* =============================
REGISTRO / IDMP TRANSACTION
============================= */

const tx = await Transaction.findOneAndUpdate(
  { mpPaymentId: String(payment.id) },
  {
    $set: {
      mpPaymentId: String(payment.id),
      paymentId: String(payment.id),
      status: String(status || '').toLowerCase(),
      amount: Number(payment.transaction_amount || 0),
      currency: payment.currency_id || 'BRL',
      paymentMethod: payment.payment_method_id === 'pix' ? 'pix' : 'manual',
      method: payment.payment_method_id || null,
      userId: metadata.user_id || null,
      metadata,
      raw: payment,
      type:
        metadata.type === 'access'
          ? 'access'
          : metadata.type === 'subscription'
          ? 'subscription'
          : 'monthly_fee',
    },
    $setOnInsert: {
      aplicadoAoUsuario: false,
    }
  },
  { upsert: true, new: true }
);

/* =============================
SÓ APROVADO SEGUE
============================= */

if(status !== 'approved'){
return res.status(200).json({ ignored:true });
}

/* =============================
NOVO — ACESSO POR DIAS
============================= */

if(metadata.type === 'access'){

if(tx.aplicadoAoUsuario){
return res.status(200).json({ already:true });
}

const user = await User.findById(metadata.user_id)

if(user){

const dias = Number(metadata.dias || 0)

if(dias > 0){

const agora = new Date()

// se já tiver acesso ativo soma
if(user.acessoExpiraEm && user.acessoExpiraEm > agora){

user.acessoExpiraEm = new Date(
user.acessoExpiraEm.getTime() + dias * 86400000
)

}else{

user.acessoExpiraEm = new Date(
agora.getTime() + dias * 86400000
)

}

user.planoAtivo = `${dias}_dias`

await user.save()

await Transaction.updateOne(
  { mpPaymentId: String(payment.id) },
  {
    $set: {
      aplicadoAoUsuario: true,
      aplicadoEm: new Date(),
      diasLiberados: dias,
      planoAplicado: user.planoAtivo,
      acessoExpiraEm: user.acessoExpiraEm,
      valorPago: Number(payment.transaction_amount || 0),
      motivoNaoAplicado: null,
    }
  }
)

}

}

return res.status(200).json({ access:true })

}


/* =============================
PLANO 30 DIAS (subscription)
============================= */

if(metadata.type === 'subscription'){

if(tx.aplicadoAoUsuario){
return res.status(200).json({ already:true });
}

const user = await User.findById(metadata.user_id)

if(user){

const agora = new Date()

// soma 30 dias
if(user.acessoExpiraEm && user.acessoExpiraEm > agora){

user.acessoExpiraEm = new Date(
user.acessoExpiraEm.getTime() + 30 * 86400000
)

}else{

user.acessoExpiraEm = new Date(
agora.getTime() + 30 * 86400000
)

}

user.planoAtivo = '30_dias'

await user.save()

await Transaction.updateOne(
  { mpPaymentId: String(payment.id) },
  {
    $set: {
      aplicadoAoUsuario: true,
      aplicadoEm: new Date(),
      diasLiberados: 30,
      planoAplicado: '30_dias',
      acessoExpiraEm: user.acessoExpiraEm,
      valorPago: Number(payment.transaction_amount || 0),
      motivoNaoAplicado: null,
    }
  }
)

}

return res.status(200).json({ subscription:true })

}

/* =============================
LÓGICA ANTIGA (EMPRESAS)
============================= */

const mensalidade = await PagamentoMensalidade.findOne({
paymentId: payment.id
});

if(!mensalidade){
return res.status(200).json({ ignored:true });
}

if(mensalidade.status === 'pago'){
return res.status(200).json({ already:true });
}

mensalidade.status = 'pago';
mensalidade.paidAt = new Date();

await mensalidade.save();

const user = await User.findById(mensalidade.userId);

if(!user){
return res.status(200).json({ userNotFound:true });
}

const agora = new Date();

const base =
user.subscriptionExpiresAt &&
user.subscriptionExpiresAt > agora
? user.subscriptionExpiresAt
: agora;

const novaData = new Date(base);
novaData.setDate(novaData.getDate() + 30);

user.subscriptionStatus = 'active';
user.subscriptionExpiresAt = novaData;

user.mensalidadesPagas.push({
valor: mensalidade.valor,
pagoEm: new Date(),
metodo: 'pix',
paymentId: payment.id
});

await user.save();

return res.status(200).json({
success:true
});

} catch(err){

console.error('Webhook MP error',err);

return res.status(500).json({
error:true
});

}

});
/* =====================================================
   CARTÃO (FUTURO)
===================================================== */

router.post(
  '/card',
  verifyToken,
  requireVerified,
  requireRoles('empresa', 'profissional'),
  async (_req, res) => {
    return res.status(501).json({
      message: 'Pagamento cartão ainda não implementado'
    });
  }
);

module.exports = router;