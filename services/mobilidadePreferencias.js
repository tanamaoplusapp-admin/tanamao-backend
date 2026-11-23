'use strict';
// Replica a regra de elegibilidade do TanaMatch sem alterar o modulo legado.
// A preferencia do cliente vem do perfil User; opcionalmente a passageira pode
// escolher outra preferencia para a solicitacao. Nunca confie no genero enviado
// pelo aplicativo: os dois generos sao recuperados pelo servidor.
const VALIDAS = Object.freeze(['todos', 'somente_mulheres', 'somente_homens']);
function erro(status, message) { const e = new Error(message); e.status = status; throw e; }
function preferenciaParaCotacao(cliente, valor) {
  if (!cliente) erro(401, 'Cliente nao encontrado');
  const genero = cliente.genero || 'nao_informado';
  // O cadastro atual apresenta a escolha apenas para clientes cadastradas como mulheres.
  const padrao = genero === 'feminino' ? (cliente.preferenciaProfissional || 'todos') : 'todos';
  const escolha = valor === undefined ? padrao : valor;
  if (!VALIDAS.includes(escolha)) erro(400, 'Preferencia de motorista invalida');
  if (genero !== 'feminino' && escolha !== 'todos')
    erro(403, 'A preferencia de genero esta disponivel somente conforme as regras do perfil de cliente');
  return { clienteGenero: genero, preferenciaMotorista: escolha };
}
function compativel(dadosSolicitacao, motorista) {
  const generoMotorista = motorista?.genero || 'nao_informado';
  const generoCliente = dadosSolicitacao?.clienteGenero || 'nao_informado';
  const escolhaCliente = dadosSolicitacao?.preferenciaMotorista || 'todos';
  const escolhaMotorista = motorista?.preferenciaAtendimento || 'todos';
  if (escolhaCliente === 'somente_mulheres' && generoMotorista !== 'feminino') return false;
  if (escolhaCliente === 'somente_homens' && generoMotorista !== 'masculino') return false;
  if (escolhaMotorista === 'somente_mulheres' && generoCliente !== 'feminino') return false;
  if (escolhaMotorista === 'somente_homens' && generoCliente !== 'masculino') return false;
  return true;
}
module.exports = { VALIDAS, preferenciaParaCotacao, compativel };
