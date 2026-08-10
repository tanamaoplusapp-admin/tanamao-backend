const agendaService = require('../services/agendaService');
const Agenda = require('../models/Agenda');
const Mensagem = require('../models/Mensagem');
const Chat = require('../models/Chat');
const User = require('../models/user');

const { sendNotification } =
  require('../services/notificationService');
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

async function buscarClientePorTelefone(clienteTelefone, excluirUserId = null) {
  const variacoes = gerarVariacoesTelefone(clienteTelefone);

  console.log('BUSCAR CLIENTE POR TELEFONE:', {
    telefoneOriginal: clienteTelefone,
    variacoes,
    excluirUserId: excluirUserId ? String(excluirUserId) : null,
  });

  if (variacoes.length === 0) return null;

  // 🔥 BUSCA SEM FILTRO DE ROLE NO MONGO (evita erro de cast)
  const usuarios = await User.find({
    $or: [
      { telefone: { $in: variacoes } },
      { celular: { $in: variacoes } },
      { whatsapp: { $in: variacoes } },
      { phone: { $in: variacoes } },
    ],
  }).select('_id name nome telefone celular whatsapp phone tipo role perfil');

  console.log('USUÁRIOS ENCONTRADOS PELO TELEFONE:', usuarios.map((u) => ({
    id: String(u._id),
    name: u.name,
    nome: u.nome,
    telefone: u.telefone,
    celular: u.celular,
    whatsapp: u.whatsapp,
    phone: u.phone,
    tipo: u.tipo,
    role: u.role,
    perfil: u.perfil,
    ehProfissionalLogado: excluirUserId
      ? String(u._id) === String(excluirUserId)
      : false,
  })));

  // 🔥 FILTRO INTELIGENTE NO JS (REMOVE PROFISSIONAL)
  const cliente = usuarios.find((u) => {
    if (excluirUserId && String(u._id) === String(excluirUserId)) {
      return false;
    }

    const tipo = String(u.tipo || '').toLowerCase();
    const role = String(u.role || '').toLowerCase();
    const perfil = String(u.perfil || '').toLowerCase();

    const pareceProfissional =
      tipo.includes('profissional') ||
      role.includes('profissional') ||
      perfil.includes('profissional') ||
      tipo.includes('prestador') ||
      role.includes('prestador') ||
      perfil.includes('prestador');

    if (pareceProfissional) {
      return false;
    }

    return true;
  });

  console.log('CLIENTE ESCOLHIDO:', cliente
    ? {
        id: String(cliente._id),
        name: cliente.name,
        nome: cliente.nome,
        telefone: cliente.telefone,
        celular: cliente.celular,
        whatsapp: cliente.whatsapp,
        phone: cliente.phone,
      }
    : null
  );

  return cliente || null;
}
// ✅ CRIAR AGENDAMENTO
const crypto = require('crypto');

exports.criar = async (req, res) => {
  try {
    const profissionalId = req.user.id;

    const {
      clienteId,
      chatId,

      clienteNome,
      clienteTelefone,

      data,
      horaInicio,
      horaFim,

      categoria,
      servicoNome,

      origem = 'manual',
    } = req.body;

    if (
      !clienteNome ||
      !clienteTelefone ||
      !data ||
      !horaInicio ||
      !horaFim
    ) {
      return res.status(400).json({
        erro:
          'clienteNome, clienteTelefone, data, horaInicio e horaFim são obrigatórios',
      });
    }

    /* =====================================================
       TELEFONE
    ===================================================== */

    const telefoneLimpo = String(clienteTelefone)
      .replace(/\D/g, '');

    if (!telefoneLimpo) {
      return res.status(400).json({
        erro: 'Telefone inválido',
      });
    }

    /* =====================================================
       VERIFICA SE É CLIENTE TANAMÃO+
    ===================================================== */

    const ehClienteTanamao =
      !!clienteId &&
      !!chatId;

    /* =====================================================
       CONVITE
       Cliente externo recebe convite.
       Cliente Tanamão+ recebe diretamente pelo chat.
    ===================================================== */

    let conviteToken = null;
    let conviteExpiraEm = null;
    let conviteStatus = 'pendente';
    let conviteEnviadoEm = null;

    if (!ehClienteTanamao) {
      conviteToken = crypto
        .randomBytes(32)
        .toString('hex');

      conviteExpiraEm = new Date(
        Date.now() + 1000 * 60 * 60 * 24
      );

      conviteEnviadoEm = new Date();
    } else {
      conviteStatus = 'aceito';
    }

    /* =====================================================
       CRIA AGENDAMENTO
    ===================================================== */

    const agendamento = await agendaService.criar({
      profissionalId,

      clienteId:
        ehClienteTanamao
          ? clienteId
          : null,

      chatId:
        ehClienteTanamao
          ? chatId
          : null,

      clienteNome,

      clienteTelefone: telefoneLimpo,

      clienteTelefoneOriginal:
        clienteTelefone,

      data,
      horaInicio,
      horaFim,

      categoria,
      servicoNome,

      conviteToken,
      conviteExpiraEm,
      conviteStatus,
      conviteEnviadoEm,

      origem:
        ehClienteTanamao
          ? 'cliente_app'
          : origem,
    });

    /* =====================================================
       💬 ENVIA PARA O CHAT TANAMÃO+
    ===================================================== */

    let mensagem = null;

    if (ehClienteTanamao) {
      try {
        mensagem = await Mensagem.create({
          chatId: agendamento.chatId,

          remetente: profissionalId,

          type: 'agendamento',

          texto: `📅 Novo agendamento: ${
            agendamento.servicoNome ||
            agendamento.categoria ||
            'Agendamento'
          }`,

          agendamentoId:
            agendamento._id,

          agendamentoData:
            agendamento.data,

          agendamentoHoraInicio:
            agendamento.horaInicio,

          agendamentoHoraFim:
            agendamento.horaFim,

          agendamentoServico:
            agendamento.servicoNome ||
            agendamento.categoria ||
            'Agendamento',

          lidoPor: [profissionalId],
        });

        console.log(
          '📅 AGENDAMENTO ENVIADO PARA O CHAT:',
          mensagem._id
        );

      } catch (erroMensagem) {
        console.error(
          '❌ ERRO AO ENVIAR AGENDAMENTO PARA O CHAT:',
          erroMensagem
        );

        /*
          O agendamento foi criado normalmente.
          Não vamos apagar o agendamento se a
          criação da mensagem falhar.
        */
      }
    }

    /* =====================================================
       RESPOSTA CLIENTE TANAMÃO+
    ===================================================== */

    if (ehClienteTanamao) {
      return res.status(201).json({
        success: true,

        agendamento,

        mensagem,

        chatId:
          agendamento.chatId,

        clienteTanamao: true,

        message:
          'Agendamento criado e enviado para o chat.',
      });
    }

    /* =====================================================
       RESPOSTA CLIENTE EXTERNO
    ===================================================== */

    const deepLink =
      `tanamao://agenda/confirmar/${conviteToken}`;

    const webLink =
      `https://tanamao.com.br/agenda/confirmar/${conviteToken}`;

    return res.status(201).json({
      success: true,

      agendamento:
        agendamento.toObject(),

      clienteTanamao: false,

      convite: {
        token:
          conviteToken,

        expiraEm:
          conviteExpiraEm,

        deepLink,

        webLink,
      },

      mensagemSugestao:
        `Olá ${clienteNome}! ` +
        `Seu horário foi agendado para ${data} ` +
        `às ${horaInicio}. ` +
        `Acompanhe pelo app: ${webLink}`,
    });

  } catch (error) {
    console.log(
      '❌ ERRO AO CRIAR AGENDAMENTO:',
      error
    );

    return res.status(400).json({
      success: false,
      erro: error.message,
    });
  }
};
exports.aceitarConvite = async (req, res) => {
  try {
    const clienteId = req.user.id;
    const { token } = req.params;

    const agenda = await Agenda.findOne({ conviteToken: token });

    if (!agenda) {
      return res.status(404).json({
        erro: 'Convite inválido ou não encontrado',
      });
    }

   if (
  !['pendente', 'confirmado'].includes(agenda.status)
) {
  return res.status(400).json({
    erro: 'Este agendamento não está disponível',
  });
}

    if (agenda.conviteStatus === 'aceito' && agenda.clienteId) {
      return res.json({
        mensagem: 'Convite já aceito',
        agendaId: agenda._id,
        chatId: agenda.chatId,
        clienteId: agenda.clienteId,
        profissionalId: agenda.profissionalId,
      });
    }

    if (agenda.conviteExpiraEm && agenda.conviteExpiraEm < new Date()) {
      agenda.conviteStatus = 'expirado';
      await agenda.save();

      return res.status(400).json({
        erro: 'Convite expirado',
      });
    }

    if (String(clienteId) === String(agenda.profissionalId)) {
      return res.status(400).json({
        erro: 'O prestador não pode aceitar o próprio convite como cliente',
      });
    }

    let chat = null;

    if (agenda.chatId) {
      chat = await Chat.findById(agenda.chatId);
    }

    if (!chat) {
      chat = await Chat.findOne({
        participantes: {
          $all: [clienteId, agenda.profissionalId],
        },
      });
    }

    if (!chat) {
      chat = await Chat.create({
        participantes: [clienteId, agenda.profissionalId],
        ultimoTexto: '',
        atualizadoEm: new Date(),
      });
    }

 agenda.clienteId = clienteId;
agenda.chatId = chat._id;

agenda.status = 'pendente';

agenda.conviteStatus = 'aceito';
agenda.conviteAceitoEm = new Date();



    await agenda.save();

    return res.json({
      mensagem: 'Convite aceito com sucesso',
      agendaId: agenda._id,
      chatId: chat._id,
      clienteId,
      profissionalId: agenda.profissionalId,
    });
  } catch (error) {
    console.log('ERRO AO ACEITAR CONVITE DA AGENDA:', error.message);

    return res.status(500).json({
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
    // ...
  } catch (error) {
    console.log('ERRO AO ABRIR CHAT DA AGENDA:', error.message);

    return res.status(500).json({
      erro: error.message,
    });
  }

}; 
/* =====================================================
CONFIRMAR AGENDAMENTO
===================================================== */

exports.confirmar = async (req, res) => {
  try {
    const { id } = req.params;

    const usuarioId =
      req.user?.id ||
      req.user?._id;

    const agendamento =
      await Agenda.findById(id);

    if (!agendamento) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado.',
      });
    }

    // Apenas o cliente do agendamento pode confirmar
    if (
      !agendamento.clienteId ||
      String(agendamento.clienteId) !==
        String(usuarioId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Você não tem permissão para confirmar este agendamento.',
      });
    }

    if (agendamento.status === 'cancelado') {
      return res.status(400).json({
        success: false,
        message:
          'Este agendamento foi cancelado.',
      });
    }

    if (agendamento.status === 'finalizado') {
      return res.status(400).json({
        success: false,
        message:
          'Este agendamento já foi finalizado.',
      });
    }

    agendamento.status = 'confirmado';
    agendamento.confirmadoEm = new Date();
    agendamento.confirmadoPor = usuarioId;

    if (agendamento.conviteStatus === 'pendente') {
      agendamento.conviteStatus = 'aceito';
      agendamento.conviteAceitoEm = new Date();
    }

    await agendamento.save();

    return res.json({
      success: true,
      message: 'Agendamento confirmado com sucesso.',
      agendamento,
    });

  } catch (error) {
    console.error(
      '❌ ERRO AO CONFIRMAR AGENDAMENTO:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Não foi possível confirmar o agendamento.',
    });
  }
};


/* =====================================================
RECUSAR AGENDAMENTO
===================================================== */

exports.recusar = async (req, res) => {
  try {
    const { id } = req.params;

    const usuarioId =
      req.user?.id ||
      req.user?._id;

    const agendamento =
      await Agenda.findById(id);

    if (!agendamento) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado.',
      });
    }

    // Apenas o cliente do agendamento pode recusar
    if (
      !agendamento.clienteId ||
      String(agendamento.clienteId) !==
        String(usuarioId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Você não tem permissão para recusar este agendamento.',
      });
    }

    if (agendamento.status === 'cancelado') {
      return res.status(400).json({
        success: false,
        message:
          'Este agendamento já foi cancelado.',
      });
    }

    if (agendamento.status === 'finalizado') {
      return res.status(400).json({
        success: false,
        message:
          'Este agendamento já foi finalizado.',
      });
    }

    agendamento.status = 'cancelado';

    if (
      agendamento.conviteStatus === 'pendente' ||
      agendamento.conviteStatus === 'aceito'
    ) {
      agendamento.conviteStatus = 'cancelado';
    }

    await agendamento.save();

    return res.json({
      success: true,
      message: 'Agendamento recusado.',
      agendamento,
    });

  } catch (error) {
    console.error(
      '❌ ERRO AO RECUSAR AGENDAMENTO:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Não foi possível recusar o agendamento.',
    });
  }
};