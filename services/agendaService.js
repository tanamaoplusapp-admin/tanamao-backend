const Agenda = require('../models/Agenda');

/* =====================================================
   CONFLITO DE HORÁRIO
===================================================== */

function isConflito(h1Inicio, h1Fim, h2Inicio, h2Fim) {
  return h1Inicio < h2Fim && h2Inicio < h1Fim;
}

/* =====================================================
   STATUS QUE OCUPAM HORÁRIO
===================================================== */

const STATUS_ATIVOS = [
  'pendente',
  'confirmado',
];

const FILTRO_STATUS_ATIVOS = {
  $or: [
    { status: 'pendente' },
    { status: 'confirmado' },
  ],
};
/* =====================================================
   CRIAR
===================================================== */

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
  ...FILTRO_STATUS_ATIVOS,
});

  for (const ag of agendamentos) {
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

  /* =====================================================
     CONVERTER DATA + HORA PARA DATETIME
  ===================================================== */

  let dataHoraInicio = null;
  let dataHoraFim = null;

  if (data && horaInicio) {
    dataHoraInicio = new Date(
      `${data}T${horaInicio}:00`
    );
  }

  if (data && horaFim) {
    dataHoraFim = new Date(
      `${data}T${horaFim}:00`
    );
  }

  /* =====================================================
     CRIAR AGENDAMENTO
  ===================================================== */

  const novo = await Agenda.create({
    profissionalId,

    clienteId,
    chatId,

    clienteNome,
    clienteTelefone,
    clienteTelefoneOriginal:
      clienteTelefoneOriginal ||
      clienteTelefone,

    categoria:
      categoria ||
      servicoNome ||
      'Agendamento',

    servicoNome:
      servicoNome ||
      categoria ||
      'Agendamento',

    data,
    horaInicio,
    horaFim,

    dataHoraInicio,
    dataHoraFim,

    status:
  clienteId && chatId
    ? 'pendente'
    : 'confirmado',

    confirmadoEm: null,
    confirmadoPor: null,

    conviteToken,
    conviteExpiraEm,
    conviteStatus,
    conviteEnviadoEm,

    origem,
  });

  return novo;
};

/* =====================================================
   LISTAR POR CLIENTE
===================================================== */

exports.listarPorCliente = async (
  clienteId,
  telefones = []
) => {

  console.log(
    'BUSCANDO POR:',
    {
      clienteId,
      telefones,
    }
  );

  const telefonesLimpos = telefones.map((t) =>
    String(t || '').replace(/\D/g, '')
  );

 const todos = await Agenda.find({
  ...FILTRO_STATUS_ATIVOS,
})
    .populate(
      'profissionalId',
      'name nome telefone celular whatsapp phone profissao profissaoNome categoria especialidade'
    )
    .sort({
      data: 1,
      horaInicio: 1,
    });

  return todos.filter((ag) => {

    const mesmoClienteId =
      ag.clienteId &&
      String(ag.clienteId) === String(clienteId);

    const telefoneAgendamento =
      String(
        ag.clienteTelefone || ''
      ).replace(/\D/g, '');

    const mesmoTelefone =
      telefoneAgendamento &&
      telefonesLimpos.includes(
        telefoneAgendamento
      );

    return (
      mesmoClienteId ||
      mesmoTelefone
    );
  });
};

/* =====================================================
   LISTAR PROFISSIONAL
===================================================== */

exports.listar = async (
  profissionalId
) => {

 return await Agenda.find({
  profissionalId,
  ...FILTRO_STATUS_ATIVOS,
}).sort({
  data: 1,
  horaInicio: 1,
});
};

/* =====================================================
   LISTAR COM FILTRO
===================================================== */

exports.listarComFiltro = async (
  profissionalId,
  inicio,
  fim
) => {

const agendamentos = await Agenda.find({
  profissionalId,
  ...FILTRO_STATUS_ATIVOS,
}).sort({
  data: 1,
  horaInicio: 1,
});

  if (!inicio || !fim) {
    return agendamentos;
  }

  return agendamentos.filter((item) => {

    return (
      item.data >= inicio &&
      item.data <= fim
    );

  });
};

/* =====================================================
   EDITAR
===================================================== */

exports.editar = async (
  id,
  profissionalId,
  dados
) => {

  const agendamento =
    await Agenda.findOne({
      _id: id,
      profissionalId,
    });

  if (!agendamento) {
    throw new Error(
      'Agendamento não encontrado'
    );
  }

  const novaData =
    dados.data ||
    agendamento.data;

  const novaHoraInicio =
    dados.horaInicio ||
    agendamento.horaInicio;

  const novaHoraFim =
    dados.horaFim ||
    agendamento.horaFim;

  /* =====================================================
     VERIFICAR CONFLITOS
  ===================================================== */

 const agendamentos =
  await Agenda.find({
    profissionalId,
    data: novaData,

    ...FILTRO_STATUS_ATIVOS,

    _id: {
      $ne: id,
    },
  });

  for (const ag of agendamentos) {

    if (
      isConflito(
        novaHoraInicio,
        novaHoraFim,
        ag.horaInicio,
        ag.horaFim
      )
    ) {
      throw new Error(
        'Horário já ocupado'
      );
    }
  }

  /* =====================================================
     CAMPOS PERMITIDOS
  ===================================================== */

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

    if (
      dados[campo] !== undefined
    ) {
      agendamento[campo] =
        dados[campo];
    }
  }

  if (
    dados.clienteTelefoneOriginal &&
    !dados.clienteTelefone
  ) {
    agendamento.clienteTelefoneOriginal =
      dados.clienteTelefoneOriginal;
  }

  /* =====================================================
     ATUALIZAR DATETIME
  ===================================================== */

  if (
    dados.data !== undefined ||
    dados.horaInicio !== undefined
  ) {

    agendamento.dataHoraInicio =
      new Date(
        `${novaData}T${novaHoraInicio}:00`
      );
  }

  if (
    dados.data !== undefined ||
    dados.horaFim !== undefined
  ) {

    agendamento.dataHoraFim =
      new Date(
        `${novaData}T${novaHoraFim}:00`
      );
  }

  await agendamento.save();

  return agendamento;
};

/* =====================================================
   CANCELAR
===================================================== */

exports.cancelar = async (
  id,
  profissionalId
) => {

  const agendamento =
    await Agenda.findOne({
      _id: id,
      profissionalId,
    });

  if (!agendamento) {
    throw new Error(
      'Agendamento não encontrado'
    );
  }

  agendamento.status =
    'cancelado';

  if (
    agendamento.conviteStatus ===
    'pendente'
  ) {
    agendamento.conviteStatus =
      'cancelado';
  }

  await agendamento.save();

  return agendamento;
};