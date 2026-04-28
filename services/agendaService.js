const Agenda = require('../models/Agenda');

function isConflito(h1Inicio, h1Fim, h2Inicio, h2Fim) {
  return h1Inicio < h2Fim && h2Inicio < h1Fim;
}

exports.criar = async ({
  profissionalId,
  clienteNome,
  clienteTelefone,
  clienteTelefoneOriginal,
  data,
  horaInicio,
  horaFim,
  categoria,
  servicoNome,
}) => {
  const agendamentos = await Agenda.find({
    profissionalId,
    data,
    status: 'ativo',
  });

  for (let ag of agendamentos) {
    if (isConflito(horaInicio, horaFim, ag.horaInicio, ag.horaFim)) {
      throw new Error('Horário já ocupado');
    }
  }

  const novo = await Agenda.create({
    profissionalId,

    // 🔥 IMPORTANTE:
    // agenda manual NÃO vincula cliente automaticamente
    clienteId: null,
    chatId: null,

    clienteNome,
    clienteTelefone,
    clienteTelefoneOriginal: clienteTelefoneOriginal || clienteTelefone,

    categoria: categoria || servicoNome || 'Agendamento',
    servicoNome: servicoNome || categoria || 'Agendamento',

    data,
    horaInicio,
    horaFim,
    status: 'ativo',
  });

  return novo;
};

exports.listarPorCliente = async (clienteId, telefones = []) => {
  console.log('BUSCANDO POR:', { clienteId, telefones });

  const todos = await Agenda.find({
    status: 'ativo',
  })
    .populate(
      'profissionalId',
      'name nome telefone celular whatsapp phone profissao profissaoNome categoria especialidade'
    )
    .sort({ data: 1, horaInicio: 1 });

  return todos.filter((ag) => {
    const mesmoClienteId =
      ag.clienteId && String(ag.clienteId) === String(clienteId);

    const telefoneAgendamento = String(ag.clienteTelefone || '').replace(/\D/g, '');
    const mesmoTelefone = telefones.includes(telefoneAgendamento);

    return mesmoClienteId || mesmoTelefone;
  });
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

  for (let ag of agendamentos) {
    if (isConflito(novaHoraInicio, novaHoraFim, ag.horaInicio, ag.horaFim)) {
      throw new Error('Horário já ocupado');
    }
  }

  Object.assign(agendamento, dados);

  // 🔥 Segurança: não deixa edição manual contaminar cliente/chat
  if ('clienteId' in dados) {
    agendamento.clienteId = agendamento.clienteId || null;
  }

  if ('chatId' in dados) {
    agendamento.chatId = agendamento.chatId || null;
  }

  if (dados.clienteTelefoneOriginal && !dados.clienteTelefone) {
    agendamento.clienteTelefoneOriginal = dados.clienteTelefoneOriginal;
  }

  if (dados.categoria) {
    agendamento.categoria = dados.categoria;
  }

  if (dados.servicoNome) {
    agendamento.servicoNome = dados.servicoNome;
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

  await agendamento.save();

  return agendamento;
};