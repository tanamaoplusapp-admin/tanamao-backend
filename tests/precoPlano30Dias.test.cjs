const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ler = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
test('Pix assinatura 30 dias usa preco mantido no servidor', () => {
  const s = ler('routes/paymentRoutes.js');
  assert.match(s, /'30_dias':\s*\{\s*dias: 30,\s*valor: 49\.99/);
  assert.match(s, /const valor = planoInfo\.valor/);
  assert.match(s, /const amount = planoInfo\.valor/);
});
test('Checkout legado forca 30 dias a R$49,99', () => {
  const s = ler('controllers/paymentController.js');
  assert.match(s, /'30_dias':\s*\{\s*dias: 30,\s*valor: 49\.99/);
  assert.match(s, /const amount = plano30Dias \? PLANOS\['30_dias'\]\.valor : Number\(value\)/);
});
test('Webhook valida R$49,99 e nao bloqueia Pix antigo de R$59,99', () => {
  const s = ler('controllers/mercadoPagoWebhookController.js');
  assert.match(s, /30: 49\.99/);
  assert.match(s, /pagamentoLegado30Dias = planInfo\?\.dias === 30 && paidAmount === 59\.99/);
  assert.match(s, /&& !pagamentoLegado30Dias/);
});
test('Planos menores nao mudaram', () => {
  const s=ler('routes/paymentRoutes.js');
  for (const [dias,valor] of [[1,'9.99'],[7,'14.99'],[15,'29.99']]) assert.match(s,new RegExp('dias: '+dias+',\\s*valor: '+valor.replace('.','\\.')));
});
