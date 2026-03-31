const agendaService = require('../services/agendaService');


// ✅ CRIAR AGENDAMENTO
exports.criar = async (req, res) => {
  try {

    const profissionalId = req.user.id;
    const clienteId = req.user.id;

    const {
      clienteNome,
      clienteTelefone,
      data,
      horaInicio,
      horaFim,
    } = req.body;

    const agendamento = await agendaService.criar({
      profissionalId,
      clienteId,
      clienteNome,
      clienteTelefone,
      data,
      horaInicio,
      horaFim,
    });

    return res.status(201).json(agendamento);

  } catch (error) {
    return res.status(400).json({
      erro: error.message,
    });
  }
};


// 📥 LISTAR DO CLIENTE (mantido igual)
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


// 📥 LISTAR AGENDAMENTOS DO PROFISSIONAL (🔥 ATUALIZADO)
exports.listar = async (req, res) => {
  try {

    const profissionalId = req.user.id;

    // 🔥 NOVO: filtros opcionais
    const { inicio, fim } = req.query;

    let agendamentos;

    if (inicio && fim) {
      // 🔥 busca com filtro de data
      agendamentos = await agendaService.listarComFiltro(
        profissionalId,
        inicio,
        fim
      );
    } else {
      // 🔥 comportamento antigo (não quebra nada)
      agendamentos = await agendaService.listar(profissionalId);
    }

    return res.json(agendamentos);

  } catch (error) {
    return res.status(500).json({
      erro: 'Erro ao buscar agendamentos',
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