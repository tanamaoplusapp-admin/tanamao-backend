const Servico = require('../models/Servico');
const User = require('../models/user');
const Profissional = require('../models/Profissional');
const Chat = require('../models/Chat')

const { enviarPushParaUsuario } = require('../services/pushService');
const { sendNotification } = require('../services/notificationService');
const agendaService = require('../services/agendaService');



/* =====================================================
UTIL
===================================================== */

function toPoint(lng, lat) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('Latitude e longitude inválidas.');
  }

  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
}

/* =====================================================
CRIAR SERVIÇO
POST /api/servicos
===================================================== */

exports.createService = async (req, res, next) => {
  try {

let {
clienteId,
categoria,
descricao,
servicoNome,
observacoes,
latitude,
longitude,
empresaId,
profissionalId,
price,
chatId,
tipoServico,
endereco,
urgente: urgenteInput,
} = req.body || {};

// 🔥 corrige quando vier objeto
if (typeof profissionalId === 'object') {
  profissionalId = profissionalId._id;
}

console.log("TIPO SERVICO RECEBIDO:", tipoServico)
console.log("BODY:", req.body)

    if (!categoria)
      return res.status(400).json({
        message: 'categoria é obrigatória.',
      });

    if (typeof latitude !== 'number' || typeof longitude !== 'number')
      return res.status(400).json({
        message: 'latitude/longitude obrigatórios.',
      });

    const cliente = clienteId || req.user?.id || req.user?._id;

    if (!cliente)
      return res.status(400).json({
        message: 'clienteId ausente.',
      });

/* =========================
   VERIFICAR CRÉDITOS
========================= */

let profissional = null;

if (profissionalId) {

profissional = await User.findById(profissionalId)
.select(
'receberServicos acessoExpiraEm'
)

if (!profissional){
return res.status(404).json({
message:'Profissional não encontrado'
})
}

// bloqueio manual
if(profissional.receberServicos === false){
return res.status(403).json({
message:'Profissional indisponível'
})
}

}

/* =========================
   BLOQUEIO PLANO EXPIRADO
========================= */

const agora = new Date()

if(
profissionalId &&
(
!profissional.acessoExpiraEm ||
profissional.acessoExpiraEm < agora
)
){
return res.status(403).json({
message:'Profissional sem plano ativo'
})
}

/* =========================
       SLA
========================= */

const urgente =
  urgenteInput === true ||
  (typeof price === 'number' && price >= 300);

const minutos = 30;

const slaExpiraEm = new Date(
  agora.getTime() + minutos * 60 * 1000
);

const io = req.app.get('io');


/* =========================
CHAT ÚNICO (REUTILIZAR)
========================= */

let chat = null;

if (chatId) {
chat = await Chat.findById(chatId);
}

if (profissionalId) {

  chat = await Chat.findOne({
  participantes: { $all: [cliente, profissionalId] }
});

if (!chat) {
  chat = await Chat.create({
    participantes: [cliente, profissionalId],
    ultimoTexto: '',
    atualizadoEm: new Date(),
  });
}

}




// 🔥 cria service
const doc = await Servico.create({
  cliente,

  empresa: empresaId || undefined,
  profissional: profissionalId || undefined,

  // 🔥 tipo serviço seguro
  tipoServico: ['normal', 'orcamento', 'agendado'].includes(tipoServico)
    ? tipoServico
    : 'normal',

  categoria: String(categoria || '').trim(),

  // 🔥 DESCRIÇÃO CORRIGIDA
  descricao: String(
    descricao ||
    servicoNome ||
    categoria ||
    ''
  ).trim(),

  // 🔥 OBSERVAÇÕES
  observacoes: observacoes || undefined,

  // 🔥 ENDEREÇO
  endereco: endereco || undefined,

  location: toPoint(longitude, latitude),

  price: typeof price === 'number'
    ? price
    : undefined,

  // 🔥 USA CHAT ÚNICO
  chatId: chat?._id,

  status: 'pendente',
  urgente,
  slaExpiraEm,
});

/* =========================
   CANCELAR SE NÃO RESPONDER
========================= */

setTimeout(async () => {

try{

const service = await Servico.findById(doc._id)

if(!service) return

if(service.status === 'pendente'){

service.status = 'cancelado'
await service.save()

// 🔥 SOCKET
if(io && service.cliente){

io.to(service.cliente.toString()).emit(
'servico_cancelado',
{
serviceId: service._id,
motivo: 'prestador_nao_respondeu'
}
)

}

// 🔥 PUSH NOTIFICATION
try{

await enviarPushParaUsuario(service.cliente, {
title: 'Serviço cancelado',
body: 'O prestador não respondeu sua solicitação. Tente outro profissional.',
data:{
serviceId: service._id.toString(),
type:'servico_cancelado'
}
})

}catch(e){
console.log('Erro push cancelamento:',e.message)
}

}

}catch(e){
console.log('Erro SLA cancelamento:',e)
}

}, 30 * 60 * 1000)



/* =========================
   🔥 MATCHING INTELIGENTE (SEM QUEBRAR)
========================= */

let profissionaisAlvo = [];

if (profissionalId) {
  // 👉 comportamento atual (mantido)
  profissionaisAlvo = [{ userId: profissionalId }];
} else {
  // 👉 novo comportamento (matching)

  const filtro = {
    online: true,
    operationalStatus: 'disponivel',
  };

  // 🔥 só filtra se vier (não quebra nada)
  if (req.body.profissaoId) filtro.profissaoId = req.body.profissaoId;
  if (req.body.categoriaId) filtro.categoriaId = req.body.categoriaId;

  const profissionais = await Profissional.find(filtro)
    .select('userId')
    .populate({
      path: 'userId',
      select: 'acessoExpiraEm receberServicos'
    })
    .lean();

  profissionaisAlvo = profissionais.filter(p => {

    const user = p.userId;

    if (!user) return false;

    // bloqueio manual
    if (user.receberServicos === false) return false;

    // bloqueio financeiro
    const ativo =
profissional.acessoExpiraEm &&
profissional.acessoExpiraEm > new Date()

    return ativo;
  });
}
/* =========================
   SOCKET
========================= */

for (const prof of profissionaisAlvo) {

  const userId = prof.userId?.toString?.() || prof.userId;

  if (!userId) continue;

  // 🔥 EMITIR NOVO SERVIÇO PARA PROFISSIONAL
  if (io) {
    io.to(userId.toString()).emit('novo_servico', {
      serviceId: doc._id,
      categoria: doc.categoria,
      urgente: doc.urgente
    });
  }

  /* =========================
     NOTIFICAÇÃO INTERNA
  ========================= */

  try {
    await sendNotification({
      userId,
      type: 'NOVO_SERVICO',
      title: '📢 Novo serviço disponível',
      message: `Categoria: ${doc.categoria}`,
      relatedId: doc._id,
      payload: {
        categoria: doc.categoria,
        urgente: doc.urgente,
      },
    });
  } catch (e) {
    console.log('Erro notification:', e.message);
  }

  /* =========================
     PUSH
  ========================= */

  try {

    await enviarPushParaUsuario(userId, {
      title: '📢 Novo serviço para você!',
      body: `Categoria: ${doc.categoria}`,
      data: {
        serviceId: doc._id.toString(),
        type: 'nova_solicitacao',
      },
    });

  } catch (e) {
    console.log('Erro push:', e.message);
  }

}

return res.status(201).json({
  service: doc,
  chatId: chat?._id || null
});

} catch (err) {
  next(err);
}
};
/* =====================================================
BUSCAR SERVIÇO
GET /api/servicos/:id
===================================================== */

exports.getServiceById = async (req, res, next) => {

  try {

    const { id } = req.params;

    const doc = await Servico.findById(id)
      .populate('cliente', 'name email')
      .populate('profissional', 'name email')
      .populate('empresa', 'name');

    if (!doc)
      return res.status(404).json({
        message: 'Serviço não encontrado.',
      });

    return res.json({ service: doc });

  } catch (err) {
    next(err);
  }

};

/* =====================================================
ALTERAR STATUS
PUT /api/servicos/:id/status
===================================================== */

exports.updateStatus = async (req, res, next) => {

  try {

    const io = req.app.get('io');

    const { id } = req.params;
    const { status, profissionalId, empresaId } = req.body || {};

    if (!status)
      return res.status(400).json({
        message: 'status é obrigatório.',
      });

    const doc = await Servico.findById(id);

    if (!doc)
      return res.status(404).json({
        message: 'Serviço não encontrado.',
      });

    if (!doc.canTransitionTo(status))
      return res.status(400).json({
        message: `Transição inválida: ${doc.status} → ${status}`,
      });

    const eraPendente = doc.status === 'pendente';

    if (profissionalId) doc.profissional = profissionalId;
    if (empresaId) doc.empresa = empresaId;

    doc.status = status;

/* MÉTRICA */
if (status === 'aceito' && eraPendente) {

const agora = new Date();

doc.respondidoEm = agora;

const diffMs = agora - doc.createdAt;

doc.tempoRespostaSegundos =
Math.floor(diffMs / 1000);

}

await doc.save();

return res.json({ service: doc });
    

 

    /* =========================
       SOCKET
    ========================= */

    if (io) {

      if (status === 'aceito' && doc.cliente) {

        io.to(doc.cliente.toString()).emit('servico_aceito', {
          serviceId: doc._id,
          profissionalId: doc.profissional,
        });

      }

      if (status === 'cancelado' && doc.cliente) {

        io.to(doc.cliente.toString()).emit('servico_cancelado', {
          serviceId: doc._id,
        });

      }

      if (status === 'finalizado' && doc.cliente) {

        io.to(doc.cliente.toString()).emit('servico_finalizado', {
          serviceId: doc._id,
        });

      }

    }

    return res.json({ service: doc });

  } catch (err) {
    next(err);
  }

};
/* =====================================================
LISTAR POR CLIENTE
GET /api/servicos/cliente/:clienteId
===================================================== */

exports.listByCliente = async (req, res, next) => {

  try {

    const userId = req.user?.id || req.user?._id;

    const servicos = await Servico.find({
      cliente: userId
    })
    .sort({ createdAt: -1 })
    .populate('profissional', 'name')
    .populate('chatId','_id');

   const formatado = servicos.map(s => ({
  _id: s._id,
  categoria: s.categoria,
  status: s.status,
  createdAt: s.createdAt,
  price: s.price,
  chatId: s.chatId?._id,
  profissional: s.profissional
}))

    console.log('SERVICOS DO CLIENTE:', formatado);

    return res.json({ servicos: formatado });

  } catch (err) {
    next(err);
  }

};
/* =====================================================
LISTAR POR PROFISSIONAL
GET /api/servicos/profissional/:profissionalId
===================================================== */

exports.listByProfissional = async (req, res, next) => {
  try {
    const { profissionalId } = req.params;

    console.log('==============================');
    console.log('LIST BY PROFISSIONAL');
    console.log('profissionalId:', profissionalId);

    const profissionalUser = await User.findById(profissionalId)
      .select('online receberServicos acessoExpiraEm');

    if (!profissionalUser) {
      return res.status(404).json({
        message: 'Profissional não encontrado.'
      });
    }

    if (profissionalUser.online !== true) {
      return res.json({ servicos: [] });
    }

    const todos = await Servico.find().limit(5);

    console.log('TODOS SERVICOS DO BANCO:');
    todos.forEach(s => {
      console.log({
        id: s._id,
        cliente: s.cliente,
        profissional: s.profissional,
        empresa: s.empresa,
        status: s.status,
        categoria: s.categoria
      });
    });

    const servicos = await Servico.find({
      profissional: profissionalId,
    })
      .sort({ createdAt: -1 })
      .populate('cliente', 'name');

    console.log('SERVICOS FILTRADOS:', servicos.length);

    return res.json({ servicos });

  } catch (err) {
    next(err);
  }
};
/* =====================================================
LISTAR TODOS SERVIÇOS
GET /api/servicos
===================================================== */

exports.listServices = async (req, res, next) => {
  try {

    const servicos = await Servico.find()
      .sort({ createdAt: -1 })
      .populate('cliente', 'name')
      .populate('profissional', 'name');

    res.json({ servicos });

  } catch (err) {
    next(err);
  }
};
/* =====================================================
SERVIÇO ATIVO DO USUÁRIO
GET /api/servicos/ativo
===================================================== */

exports.getServicoAtivo = async (req, res, next) => {
  try {

    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(400).json({ message: 'Usuário não identificado' });
    }

    const servico = await Servico.findOne({
      $or: [
        { cliente: userId },
        { profissional: userId }
      ],
      status: { $in: ['pendente', 'aceito', 'em_andamento'] }
    })
    .sort({ createdAt: -1 })
    .populate('cliente', 'name')
    .populate('profissional', 'name');

    return res.json({ servico });

  } catch (err) {
    next(err);
  }
};
/* =====================================================
ATUALIZAR POSIÇÃO
PUT /api/servicos/:id/progress
===================================================== */

/* =====================================================
ATUALIZAR POSIÇÃO
PUT /api/servicos/:id/progress
===================================================== */

exports.updateProgress = async (req, res, next) => {

  try {

    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const servico = await Servico.findById(id);

    if (!servico)
      return res.status(404).json({
        message: 'Serviço não encontrado',
      });

    if (
      typeof latitude === 'number' &&
      typeof longitude === 'number'
    ) {

      servico.profissionalLocation = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };

    }

    await servico.save();

    return res.json({ servico });

  } catch (err) {
    next(err);
  }

};
exports.salvarAgendamento = async (req,res)=>{

try{

const { id } = req.params
const { dataAgendada, horaAgendada, valorFinal } = req.body

const service = await Servico.findById(id)
const profissional = await User.findById(service.profissional)
.select('acessoExpiraEm receberServicos')

if(!profissional){
return res.status(404).json({erro:'Profissional não encontrado'})
}

if(profissional.receberServicos === false){
return res.status(403).json({erro:'Profissional bloqueado'})
}

const ativo =
user.acessoExpiraEm &&
user.acessoExpiraEm > new Date()

if(!ativo){
return res.status(403).json({
erro:'Sem crédito ou mensalidade'
})
}
if(!service){
return res.status(404).json({erro:'Serviço não encontrado'})
}

service.dataAgendada = dataAgendada
service.horaAgendada = horaAgendada
service.valorFinal = valorFinal

await service.save()

res.json({service})

}catch(e){
res.status(500).json({erro:e.message})
}

}

/* =====================================================
ACEITAR SERVICE (AGENDAMENTO)
PATCH /api/servicos/:id/aceitar
===================================================== */

exports.aceitarService = async (req,res)=>{

  try{

    const io = req.app.get('io')

    const { id } = req.params

    const service = await Servico.findById(id)
      .populate('cliente','name telefone')
      .populate('profissional','name')

    if(!service){
      return res.status(404).json({erro:'Serviço não encontrado'})
    }

    service.status = 'aceito'
    await service.save()

    // 🔥 EMITIR SOCKET PARA PRESTADOR
    if(io && service.profissional){
      io.to(service.profissional._id.toString()).emit(
        'servico_aceito',
        {
          serviceId: service._id,
          status:'aceito'
        }
      )
    }

    // 🔥 EMITIR SOCKET PARA CLIENTE
    if(io && service.cliente){
      io.to(service.cliente._id.toString()).emit(
        'servico_aceito',
        {
          serviceId: service._id,
          status:'aceito'
        }
      )
    }

    if(service.tipoServico === 'agendado'){
      await agendaService.criar({
        profissionalId: service.profissional,
        clienteId: service.cliente._id,
        clienteNome: service.cliente.name,
        clienteTelefone: service.cliente.telefone,
        data: service.dataAgendada,
        horaInicio: service.horaAgendada,
        horaFim: service.horaAgendada
      })
    }

    res.json({service})

   } catch(e){
    res.status(500).json({erro:e.message})
  }
  };