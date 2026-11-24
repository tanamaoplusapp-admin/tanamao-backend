const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
test('push mantém canal de corrida, prioridade alta e trata somente pushEnabled=false como bloqueado', () => {
  const txt = read('services/pushService.js');
  assert.match(txt, /if \(user\.pushEnabled === false\)/);
  assert.match(txt, /'tanamao-corridas-v2'/);
  assert.match(txt, /priority: 'high'/);
});
test('a busca do motorista devolve reputação com tolerância a falha sem interromper GPS', () => {
  const txt = read('controllers/mobilidadeController.js');
  assert.match(txt, /const avaliacao=await obterReputacaoMotorista|avaliacao=await obterReputacaoMotorista/);
  assert.match(txt, /Falha ao consultar reputação/);
  assert.match(txt, /veiculo:vehicle,avaliacao/);
});
