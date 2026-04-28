const agendaService = require('../services/agendaService');
const User = require('../models/user');
const Agenda = require('../models/Agenda');
const Chat = require('../models/Chat');
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
  categoria,
  servicoNome,
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
  categoria,
  servicoNome,
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

    const user = await User.findById(clienteId);

   const telefoneBase =
  user?.telefone ||
  user?.phone ||
  user?.celular ||
  user?.whatsapp ||
  '';
    const telefones = gerarVariacoesTelefone(telefoneBase);

    console.log('CLIENTE ID:', clienteId);
    console.log('TELEFONE BASE:', telefoneBase);
    console.log('VARIAÇÕES:', telefones);

    const agendamentos = await agendaService.listarPorCliente(
      clienteId,
      telefones
    );

    return res.json(agendamentos);
  } catch (error) {
    console.log('ERRO AO BUSCAR AGENDA DO CLIENTE:', error.message);

    return res.status(500).json({
      erro: error.message,
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
exports.abrirChatCliente = async (req, res) => {
  try {
    const usuarioLogadoId = String(req.user.id);
    const { id } = req.params;

    const agenda = await Agenda.findById(id);

    if (!agenda) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' });
    }

    const profissionalId = String(agenda.profissionalId);

    const usuarioLogado = await User.findById(usuarioLogadoId);

    const telefoneBase =
      usuarioLogado?.telefone ||
      usuarioLogado?.phone ||
      usuarioLogado?.celular ||
      usuarioLogado?.whatsapp ||
      '';

    const telefones = gerarVariacoesTelefone(telefoneBase);
    const agendaTelefone = String(agenda.clienteTelefone || '').replace(/\D/g, '');

    const pertenceAoCliente =
      String(agenda.clienteId || '') === usuarioLogadoId ||
      telefones.includes(agendaTelefone);

    const pertenceAoProfissional =
      profissionalId === usuarioLogadoId;

    if (!pertenceAoCliente && !pertenceAoProfissional) {
      return res.status(403).json({
        erro: 'Sem permissão para abrir este chat',
      });
    }

    // 🔥 Regra central:
    // chat do app só pode abrir se existir clienteId real.
    // Se agenda foi criada só por telefone, não dá para saber qual usuário do app é o cliente.
    if (!agenda.clienteId) {
      return res.status(400).json({
        erro: 'Este agendamento não está vinculado a um cliente do app. Confirme via WhatsApp ou peça para o cliente salvar o telefone no perfil igual ao número do agendamento.',
      });
    }

    const clienteIdStr = String(agenda.clienteId);

    let chat = await Chat.findOne({
      $and: [
        { participantes: clienteIdStr },
        { participantes: profissionalId },
        { $expr: { $eq: [{ $size: '$participantes' }, 2] } },
      ],
    });

    if (!chat) {
      chat = await Chat.create({
        participantes: [clienteIdStr, profissionalId],
        ultimoTexto: '',
        atualizadoEm: new Date(),
      });
    }

    return res.json({
      chatId: chat._id,
      clienteId: clienteIdStr,
      profissionalId,
      agendaId: agenda._id,
    });
  } catch (error) {
    console.log('ERRO AO ABRIR CHAT DA AGENDA:', error.message);

    return res.status(500).json({
      erro: error.message,
    });
  }
};