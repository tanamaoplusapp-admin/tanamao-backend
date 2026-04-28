const agendaService = require('../services/agendaService');
const User = require('../models/user');

// Remove tudo que não for número
function limparTelefone(telefone = '') {
  return String(telefone).replace(/\D/g, '');
}

// Gera variações para Brasil + Paraguai
function gerarVariacoesTelefone(telefone = '') {
  const numero = limparTelefone(telefone);

  if (!numero) return [];

  const variacoes = new Set();

  // original limpo
  variacoes.add(numero);

  // -------------------------
  // BRASIL
  // -------------------------
  // se já vier com 55
  if (numero.startsWith('55')) {
    variacoes.add(numero.slice(2));
  }

  // se parecer número nacional BR sem DDI
  // ex: 67999999999, 1133334444
  if (!numero.startsWith('55') && !numero.startsWith('595')) {
    variacoes.add(`55${numero}`);
  }

  // -------------------------
  // PARAGUAI
  // -------------------------
  // se já vier com 595
  if (numero.startsWith('595')) {
    variacoes.add(numero.slice(3));
  }

  // se parecer número local PY sem DDI
  // ex: 981123456
  if (
    !numero.startsWith('55') &&
    !numero.startsWith('595') &&
    numero.length >= 8 &&
    numero.length <= 10
  ) {
    variacoes.add(`595${numero}`);
  }

  // remove zero inicial em algumas digitações locais
  if (numero.startsWith('0')) {
    const semZero = numero.replace(/^0+/, '');
    if (semZero) {
      variacoes.add(semZero);
      variacoes.add(`55${semZero}`);
      variacoes.add(`595${semZero}`);
    }
  }

  return Array.from(variacoes);
}

async function buscarClientePorTelefone(clienteTelefone) {
  const variacoes = gerarVariacoesTelefone(clienteTelefone);

  if (variacoes.length === 0) return null;

  // Ajuste os campos se no seu User eles tiverem nomes diferentes
  const cliente = await User.findOne({
    $or: [
      { telefone: { $in: variacoes } },
      { celular: { $in: variacoes } },
      { whatsapp: { $in: variacoes } },
      { phone: { $in: variacoes } },
    ],
  });

  return cliente || null;
}

// ✅ CRIAR AGENDAMENTO
exports.criar = async (req, res) => {
  try {
    const profissionalId = req.user.id;

    const {
      clienteNome,
      clienteTelefone,
      data,
      horaInicio,
      horaFim,
    } = req.body;

    if (!clienteNome || !clienteTelefone || !data || !horaInicio || !horaFim) {
      return res.status(400).json({
        erro: 'clienteNome, clienteTelefone, data, horaInicio e horaFim são obrigatórios',
      });
    }

    const telefoneLimpo = limparTelefone(clienteTelefone);

    if (!telefoneLimpo) {
      return res.status(400).json({
        erro: 'Telefone do cliente inválido',
      });
    }

    const cliente = await buscarClientePorTelefone(telefoneLimpo);
    const clienteId = cliente ? cliente._id : null;

    const agendamento = await agendaService.criar({
      profissionalId,
      clienteId,
      clienteNome,
      clienteTelefone: telefoneLimpo,
      clienteTelefoneOriginal: clienteTelefone,
      data,
      horaInicio,
      horaFim,
    });

    return res.status(201).json({
      ...agendamento.toObject(),
      clienteEncontrado: !!clienteId,
    });
  } catch (error) {
    return res.status(400).json({
      erro: error.message,
    });
  }
};

// 📥 LISTAR DO CLIENTE
exports.listarCliente = async (req, res) => {
  try {
    const clienteId = req.user.id;

    const agendamentos = await agendaService.listarPorCliente(clienteId);

    return res.json(agendamentos);

  } catch (error) {
    return res.status(500).json({
      erro: 'Erro ao buscar agendamentos do cliente',
    });
  }
};

// 📥 LISTAR AGENDAMENTOS DO PROFISSIONAL
exports.listar = async (req, res) => {
  try {
    const profissionalId = req.user.id;
    const { inicio, fim } = req.query;

    let agendamentos;

    if (inicio && fim) {
      agendamentos = await agendaService.listarComFiltro(
        profissionalId,
        inicio,
        fim
      );
    } else {
      agendamentos = await agendaService.listar(profissionalId);
    }

    return res.json(agendamentos);

  } catch (error) {
  console.log('ERRO REAL AO BUSCAR AGENDA:', error);
  console.log('MENSAGEM:', error.message);

  return res.status(500).json({
    erro: error.message,
  });
}
};

// ✏️ EDITAR
exports.editar = async (req, res) => {
  try {
    const profissionalId = req.user.id;
    const { id } = req.params;

    const agendamento = await agendaService.editar(
      id,
      profissionalId,
      req.body
    );

    return res.json(agendamento);

  } catch (error) {
    return res.status(400).json({
      erro: error.message,
    });
  }
};

// ❌ CANCELAR
exports.cancelar = async (req, res) => {
  try {
    const profissionalId = req.user.id;
    const { id } = req.params;

    const agendamento = await agendaService.cancelar(
      id,
      profissionalId
    );

    return res.json({
      mensagem: 'Agendamento cancelado',
      agendamento,
    });

  } catch (error) {
    return res.status(400).json({
      erro: error.message,
    });
  }
};