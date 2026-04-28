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
  clienteTelefoneOriginal,
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
    clienteId: clienteId || null,
    clienteNome,
    clienteTelefone,
    clienteTelefoneOriginal: clienteTelefoneOriginal || clienteTelefone,
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
  .sort({ data: 1, horaInicio: 1 });
};


// 📥 LISTAR AGENDAMENTOS DO PROFISSIONAL
exports.listar = async (profissionalId) => {
  return await Agenda.find({
    profissionalId,
    status: 'ativo',
  })
    .sort({ data: 1, horaInicio: 1 });
};


// 🔥 📥 LISTAR COM FILTRO
exports.listarComFiltro = async (profissionalId, inicio, fim) => {
  const filtro = {
    profissionalId,
    status: 'ativo',
  };

  // Como "data" está em String no formato YYYY-MM-DD,
  // filtra como string para manter compatibilidade
  if (inicio && fim) {
    filtro.data = {
      $gte: inicio,
      $lte: fim,
    };
  }

return await Agenda.find(filtro)
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
    if (
      isConflito(
        novaHoraInicio,
        novaHoraFim,
        ag.horaInicio,
        ag.horaFim
      )
    ) {
      throw new Error('Horário já ocupado');
    }
  }

  Object.assign(agendamento, dados);

  if (dados.clienteTelefoneOriginal && !dados.clienteTelefone) {
    agendamento.clienteTelefoneOriginal = dados.clienteTelefoneOriginal;
  }

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