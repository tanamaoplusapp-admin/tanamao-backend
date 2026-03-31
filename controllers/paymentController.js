// controllers/paymentController.js

const { mp, Payment } = require('../services/mercadoPago')
const Company = require('../models/company')
const User = require('../models/user')
const config = require('../config/env')

const { sendNotification } = require('../services/notificationService')

/* =========================================================
HELPERS
========================================================= */

const asMoney = (n) => Number((Number(n) || 0).toFixed(2))

const idemKey = (prefix) =>
`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

const getUserId = (req) =>
(req.user?._id || req.userId || req.user?.id || '').toString()

function getCollectorId(companyDoc) {
return companyDoc?.collectorId || companyDoc?.collector_id || ''
}

function getCommissionRate(porte) {

const p = String(porte || '').toLowerCase()

const rates = config.payments?.commission?.empresa || {}

if (p === 'mei') return Number(rates.mei ?? 0.03)
if (p === 'pequena') return Number(rates.pequeno ?? 0.05)
if (p === 'media' || p === 'média') return Number(rates.medio ?? 0.07)
if (p === 'grande') return Number(rates.grande ?? 0.10)

return Number(rates.pequeno ?? 0.05)

}

function baseStatement() {
return (config.mercadoPago?.statementDescriptor || 'TANAMAO+').slice(0, 22)
}

/* =========================================================
PIX
========================================================= */

const processarPagamentoPix = async (req, res) => {

try {

const userId = getUserId(req)

const {
value,
payer = {},
description,
companyId,
serviceId,
motoristaId,
plano,
tipo = 'servico_profissional'
} = req.body || {}

const amount = Number(value)

if (!Number.isFinite(amount) || amount <= 0) {
return res.status(400).json({ error: 'Valor inválido' })
}

let applicationFee = 0
let collectorId = null
let porteEmpresa = null

/* =============================
EMPRESAS (SPLIT AUTOMÁTICO)
============================= */

if (tipo === 'servico_empresa' && companyId) {

const company = await Company.findById(companyId).lean()

if (!company)
return res.status(404).json({ error: 'Empresa não encontrada' })

collectorId = getCollectorId(company)

if (!collectorId)
return res.status(400).json({
error: 'Empresa sem collectorId configurado'
})

const rate = getCommissionRate(
company.porteEmpresa || company.porteOriginal
)

applicationFee = asMoney(amount * rate)

porteEmpresa =
company.porteEmpresa || company.porteOriginal || 'pequena'

}

/* =============================
CRIAR PAGAMENTO
============================= */

const body = {

transaction_amount: amount,

description: (description || 'Pagamento Tanamão').toString(),

payment_method_id: 'pix',

payer: {
email: payer.email || 'comprador@email.com',
first_name: payer.nome || 'Usuário',
identification: payer.cpf
? { type: 'CPF', number: String(payer.cpf) }
: undefined
},

statement_descriptor: baseStatement(),

notification_url:
config.mercadoPago?.webhookUrl ||
process.env.MP_WEBHOOK_URL ||
undefined,

application_fee: applicationFee || undefined,

sponsor_id: collectorId || undefined,

metadata: {

type: tipo,

origem: 'tanamao',

user_id: userId || null,

quantidade: req.body.quantidade || null,

plano: plano || null,

service_id: serviceId || null,

meio: 'pix'

}

}

const payment = await new Payment(mp).create({
body,
requestOptions: { idempotencyKey: idemKey('pix') }
})

const tx = payment?.point_of_interaction?.transaction_data

if (!tx?.qr_code || !tx?.qr_code_base64) {
return res
.status(502)
.json({ error: 'Não foi possível gerar o QR do Pix.' })
}

return res.json({

id: payment.id,

status: payment.status,

amount: payment.transaction_amount,

qr_code_base64: tx.qr_code_base64,

qr_code: tx.qr_code,

expiration_time: tx.expiration_time

})

} catch (error) {

console.error('Erro ao processar Pix:', error)

return res.status(500).json({
error: 'Erro ao processar pagamento Pix',
details: error?.message || error
})

}

}

/* =========================================================
CARTÃO
========================================================= */

const processarPagamentoCartao = async (req, res) => {

try {

const userId = getUserId(req)

const {
token,
value,
payer = {},
installments,
description,
payment_method_id,
companyId,
serviceId,
motoristaId,
plano,
tipo = 'servico_profissional'
} = req.body || {}

const amount = Number(value)

if (!token)
return res.status(400).json({
error: 'token do cartão é obrigatório'
})

if (!Number.isFinite(amount) || amount <= 0)
return res.status(400).json({ error: 'Valor inválido' })

let applicationFee = 0
let collectorId = null
let porteEmpresa = null

if (tipo === 'servico_empresa' && companyId) {

const company = await Company.findById(companyId).lean()

if (!company)
return res.status(404).json({ error: 'Empresa não encontrada' })

collectorId = getCollectorId(company)

const rate = getCommissionRate(
company.porteEmpresa || company.porteOriginal
)

applicationFee = asMoney(amount * rate)

porteEmpresa =
company.porteEmpresa || company.porteOriginal || 'pequena'

}

const body = {

token,

binary_mode: true,

transaction_amount: amount,

description: (description || 'Pagamento Tanamão').toString(),

installments: Number(installments || 1),

payment_method_id: payment_method_id || undefined,

payer: {
email: payer.email || 'comprador@email.com',
identification: payer.cpf
? { type: 'CPF', number: String(payer.cpf) }
: undefined
},

statement_descriptor: baseStatement(),

notification_url:
config.mercadoPago?.webhookUrl ||
process.env.MP_WEBHOOK_URL ||
undefined,

application_fee: applicationFee || undefined,

sponsor_id: collectorId || undefined,

metadata: {

type: tipo,

origem: 'tanamao',

user_id: userId || null,

quantidade: req.body.quantidade || null,

plano: plano || null,

service_id: serviceId || null,

meio: 'card'

}

}

const payment = await new Payment(mp).create({
body,
requestOptions: { idempotencyKey: idemKey('card') }
})

return res.json({
id: payment.id,
status: payment.status,
amount: payment.transaction_amount
})

} catch (error) {

console.error('Erro pagamento cartão:', error)

return res.status(500).json({
error: 'Erro ao processar cartão',
details: error?.message || error
})

}

}

/* =========================================================
CONSULTAR STATUS
========================================================= */

const getPaymentStatus = async (req, res) => {

try {

const { paymentId } = req.params

if (!paymentId)
return res.status(400).json({
error: 'paymentId é obrigatório'
})

const payment = await new Payment(mp).get({ id: paymentId })

const tipo = payment?.metadata?.type
const userId = payment?.metadata?.user_id

/* =============================
PAGAMENTO CONFIRMADO
============================= */

if (payment.status === 'approved') {

if (userId) {

await sendNotification({

userId,

type: 'PAGAMENTO_CONFIRMADO',

title: '💰 Pagamento confirmado',

message: 'Seu pagamento foi aprovado com sucesso.',

relatedId: paymentId

})

}

/* =============================
AÇÕES POR TIPO
============================= */

switch (tipo) {

case 'mensalidade_profissional':
// ativar plano prestador
break

case 'mensalidade_empresa':
// ativar plano empresa
break

case 'mensalidade_motorista':
// ativar plano motorista
break

switch (tipo) {

case 'credits':
break

case 'subscription':
break

case 'bonus':
break

}

case 'comissao_motorista':
// baixar comissão motorista
break

case 'servico_empresa':
// serviço pago empresa
break

case 'servico_profissional':
// serviço pago prestador
break

case 'servico_motorista':
// corrida paga
break

}

}

return res.json({

id: payment.id,

status: payment.status,

status_detail: payment.status_detail,

amount: payment.transaction_amount,

metadata: payment?.metadata

})

} catch (err) {

console.error('Erro ao consultar pagamento:', err)

return res.status(500).json({
error: 'Erro ao consultar status',
details: err?.message || err
})

}

}

/* =========================================================
EXPORT
========================================================= */

module.exports = {

processarPagamentoPix,

processarPagamentoCartao,

getPaymentStatus

}