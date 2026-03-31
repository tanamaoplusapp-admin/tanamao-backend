const Agenda = require('../models/Agenda');

// 🔥 FUNÇÃO AUXILIAR (comparar horários)
function isConflito(h1Inicio, h1Fim, h2Inicio, h2Fim) {
  return h1Inicio < h2Fim && h2Inicio < h1Fim;
}


// ✅ CRIAR AGENDAMENTO
exports.criar = async ({
  profissionalId,
  clienteId,
  clienteNome,
  clienteTelefone,
  data,
  horaInicio,
  horaFim,
}) => {

  const agendamentos = await Agenda.find({
    profissionalId,
    data,
    status: 'ativo',
  });

  for (let ag of agendamentos) {
    if (
      isConflito(
        horaInicio,
        horaFim,
        ag.horaInicio,
        ag.horaFim
      )
    ) {
      throw new Error('Horário já ocupado');
    }
  }

  const novo = await Agenda.create({
    profissionalId,
    clienteId,
    clienteNome,
    clienteTelefone,
    data,
    horaInicio,
    horaFim,
    status: 'ativo',
  });

  return novo;
};


// 🔥 📥 LISTAR AGENDAMENTOS DO CLIENTE
exports.listarPorCliente = async (clienteId) => {
  return await Agenda.find({
    clienteId,
    status: 'ativo',
  })
    .populate('profissionalId')
    .sort({ data: 1, horaInicio: 1 });
};


// 📥 LISTAR AGENDAMENTOS DO PROFISSIONAL (MANTIDO)
exports.listar = async (profissionalId) => {
  return await Agenda.find({
    profissionalId,
    status: 'ativo',
  })
    .sort({ data: 1, horaInicio: 1 });
};


// 🔥 📥 LISTAR COM FILTRO (NOVO - SEM QUEBRAR NADA)
exports.listarComFiltro = async (profissionalId, inicio, fim) => {

  const filtro = {
    profissionalId,
    status: 'ativo',
  };

  // 🔥 só aplica se vier corretamente
  if (inicio && fim) {
    filtro.data = {
      $gte: new Date(inicio),
      $lte: new Date(fim),
    };
  }

  return await Agenda.find(filtro)
    .populate('profissionalId')
    .sort({ data: 1, horaInicio: 1 });
};


// ✏️ EDITAR
exports.editar = async (id, profissionalId, dados) => {

  const agendamento = await Agenda.findOne({
    _id: id,
    profissionalId,
  });

  if (!agendamento) {
    throw new Error('Agendamento não encontrado');
  }

  const agendamentos = await Agenda.find({
    profissionalId,
    data: dados.data,
    status: 'ativo',
    _id: { $ne: id },
  });

  for (let ag of agendamentos) {
    if (
      isConflito(
        dados.horaInicio,
        dados.horaFim,
        ag.horaInicio,
        ag.horaFim
      )
    ) {
      throw new Error('Horário já ocupado');
    }
  }

  Object.assign(agendamento, dados);

  await agendamento.save();

  return agendamento;
};


// ❌ CANCELAR
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