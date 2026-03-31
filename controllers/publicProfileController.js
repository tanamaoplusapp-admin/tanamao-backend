const User = require('../models/user');
const Order = require('../models/order');

exports.getPublicUserProfile = async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .select('name role online avatar')
    .lean();

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  let statusPublico = 'Indisponível';
  let emAtendimento = false;
  let emCorrida = false;

  // =========================
  // PROFISSIONAL
  // =========================
  if (user.role === 'profissional') {
    emAtendimento = await Order.exists({
      profissionalId: user._id,
      status: { $in: ['aceito', 'em_andamento'] },
    });

    if (user.online && emAtendimento) {
      statusPublico = 'Em atendimento';
    } else if (user.online) {
      statusPublico = 'Disponível';
    }
  }

  // =========================
  // MOTORISTA
  // =========================
  if (user.role === 'motorista') {
    emCorrida = await Order.exists({
      motoristaId: user._id,
      status: { $in: ['aceito', 'em_andamento', 'coletado'] },
    });

    if (user.online && emCorrida) {
      statusPublico = 'Em corrida';
    } else if (user.online) {
      statusPublico = 'Disponível';
    }
  }

  res.json({
    id: user._id,
    tipo: user.role,
    nome: user.name,
    foto: user.avatar || null,
    online: user.online,
    emAtendimento: Boolean(emAtendimento),
    emCorrida: Boolean(emCorrida),
    statusPublico,
  });
};
