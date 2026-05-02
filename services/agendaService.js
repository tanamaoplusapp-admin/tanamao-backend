const Agenda = require('../models/Agenda');

function isConflito(h1Inicio, h1Fim, h2Inicio, h2Fim) {
  return h1Inicio < h2Fim && h2Inicio < h1Fim;
}

exports.criar = async ({
  profissionalId,
  clienteId = null,
  chatId = null,

  clienteNome,
  clienteTelefone,
  clienteTelefoneOriginal,

  data,
  horaInicio,
  horaFim,

  categoria,
  servicoNome,

  conviteToken = null,
  conviteExpiraEm = null,
  conviteStatus = 'pendente',
  conviteEnviadoEm = null,

  origem = 'manual',
}) => {
  const agendamentos = await Agenda.find({
    profissionalId,
    data,
    status: 'ativo',
  });

  for (const ag of agendamentos) {
    if (isConflito(horaInicio, horaFim, ag.horaInicio, ag.horaFim)) {
      throw new Error('Horário já ocupado');
    }
  }

  const novo = await Agenda.create({
    profissionalId,

    clienteId,
    chatId,

    clienteNome,
    clienteTelefone,
    clienteTelefoneOriginal: clienteTelefoneOriginal || clienteTelefone,

    categoria: categoria || servicoNome || 'Agendamento',
    servicoNome: servicoNome || categoria || 'Agendamento',

    data,
    horaInicio,
    horaFim,

    status: 'ativo',

    conviteToken,
    conviteExpiraEm,
    conviteStatus,
    conviteEnviadoEm,

    origem,
  });

  return novo;
};

exports.listarPorCliente = async (clienteId, telefones = []) => {
  const telefonesValidos = Array.isArray(telefones)
    ? telefones
        .map((telefone) => String(telefone || '').replace(/\D/g, ''))
        .filter(Boolean)
    : [];

  const telefonesUnicos = [...new Set(telefonesValidos)];

  const filtrosCliente = [];

  if (clienteId) {
    filtrosCliente.push({ clienteId });
  }

  telefonesUnicos.forEach((telefone) => {
    filtrosCliente.push({
      clienteTelefone: telefone,
    });
  });

  const query = {
    status: 'ativo',
    ...(filtrosCliente.length > 0
      ? { $or: filtrosCliente }
      : {}),
  };

  console.log('BUSCANDO POR:', query);

  const agendamentos = await Agenda.find(query)
    .populate(
      'profissionalId',
      'name nome photoUrl avatar foto imagem telefone celular whatsapp phone profissao profissaoNome categoria especialidade'
    )
    .sort({ data: 1, horaInicio: 1 });

  return agendamentos;
};

exports.listar = async (profissionalId) => {
  return await Agenda.find({
    profissionalId,
    status: 'ativo',
  }).sort({ data: 1, horaInicio: 1 });
};

exports.listarComFiltro = async (profissionalId, inicio, fim) => {
  const agendamentos = await Agenda.find({
    profissionalId,
    status: 'ativo',
  }).sort({ data: 1, horaInicio: 1 });

  if (!inicio || !fim) return agendamentos;

  return agendamentos.filter((item) => {
    return item.data >= inicio && item.data <= fim;
  });
};

exports.editar = async (id, profissionalId, dados) => {
  const agendamento = await Agenda.findOne({
    _id: id,
    profissionalId,
  });

  if (!agendamento) {
    throw new Error('Agendamento não encontrado');
  }

  const novaData = dados.data || agendamento.data;
  const novaHoraInicio = dados.horaInicio || agendamento.horaInicio;
  const novaHoraFim = dados.horaFim || agendamento.horaFim;

  const agendamentos = await Agenda.find({
    profissionalId,
    data: novaData,
    status: 'ativo',
    _id: { $ne: id },
  });

  for (const ag of agendamentos) {
    if (isConflito(novaHoraInicio, novaHoraFim, ag.horaInicio, ag.horaFim)) {
      throw new Error('Horário já ocupado');
    }
  }

  const camposPermitidos = [
    'clienteNome',
    'clienteTelefone',
    'clienteTelefoneOriginal',
    'data',
    'horaInicio',
    'horaFim',
    'categoria',
    'servicoNome',
    'status',
  ];

  for (const campo of camposPermitidos) {
    if (dados[campo] !== undefined) {
      agendamento[campo] = dados[campo];
    }
  }

  if (dados.clienteTelefoneOriginal && !dados.clienteTelefone) {
    agendamento.clienteTelefoneOriginal = dados.clienteTelefoneOriginal;
  }

  await agendamento.save();

  return agendamento;
};

exports.cancelar = async (id, profissionalId) => {
  const agendamento = await Agenda.findOne({
    _id: id,
    profissionalId,
  });

  if (!agendamento) {
    throw new Error('Agendamento não encontrado');
  }

  agendamento.status = 'cancelado';

  if (agendamento.conviteStatus === 'pendente') {
    agendamento.conviteStatus = 'cancelado';
  }

  await agendamento.save();

  return agendamento;
};