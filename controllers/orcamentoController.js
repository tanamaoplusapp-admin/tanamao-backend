
const Profissional = require('../models/Profissional');
const gerarOrcamentoPdf = require('../services/pdf/gerarOrcamentoPdf');
const Orcamento = require('../models/Orcamento');

const {
  gerarNumeroDocumento,
} = require('../services/counterService');

/* =====================================================
   AUTH
===================================================== */

const getUserId = (req) =>
  req.userId ||
  req.user?.id ||
  req.user?._id ||
  null;

/* =====================================================
   CRIAR ORÇAMENTO
===================================================== */

exports.criarOrcamento = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.',
      });
    }

    const profissional = await Profissional.findOne({
      userId,
    });

    if (!profissional) {
      return res.status(404).json({
        error: 'Profissional não encontrado.',
      });
    }

    const {
      titulo = '',
      clienteId = null,
      cliente = {},
      origem = 'manual',
      chatId = null,
      mensagemId = null,
      itens = [],
      desconto = 0,
      acrescimo = 0,
      formaPagamento = '',
      validade = null,
      observacoes = '',
      layout = {},
      status = 'rascunho',
    } = req.body;
if (!Array.isArray(itens) || itens.length === 0) {
  return res.status(400).json({
    error: 'Adicione pelo menos um serviço.',
  });
}
    /* ==========================
       REVALIDA ITENS
    ========================== */

    let subtotal = 0;

    const itensCalculados = itens.map((item) => {
      const quantidade = Number(item.quantidade || 1);

      const valorUnitario = Number(item.valorUnitario || 0);

      const descontoItem = Number(item.desconto || 0);

      const subtotalItem =
        quantidade * valorUnitario - descontoItem;

      subtotal += subtotalItem;

      return {
        descricao: item.descricao,
        quantidade,
        valorUnitario,
        desconto: descontoItem,
        subtotal: subtotalItem,
      };
    });

    const total =
      subtotal -
      Number(desconto || 0) +
      Number(acrescimo || 0);

    /* ==========================
       NÚMERO DO DOCUMENTO
    ========================== */

    const numero = await gerarNumeroDocumento(
      'ORC'
    );

    /* ==========================
       SNAPSHOT PROFISSIONAL
    ========================== */

    const snapshotProfissional = {
      nome: profissional.name,
      profissao:
        profissional.profissaoNome ||
        profissional.profissoes?.[0] ||
        '',
      telefone: profissional.phone,
      email: profissional.email,
      foto: profissional.photoUrl,
    };

    /* ==========================
       CRIA DOCUMENTO
    ========================== */

    const novo = await Orcamento.create({
      numero,
      titulo,

      profissionalId: profissional._id,

      profissional: snapshotProfissional,

      clienteId,

      cliente: {
  nome: cliente?.nome || '',
  telefone: cliente?.telefone || '',
  email: cliente?.email || '',
  endereco: cliente?.endereco || '',
},

      origem,

      chatId,

      mensagemId,

      itens: itensCalculados,

      subtotal,

      desconto,

      acrescimo,

      total,

      formaPagamento,

      validade,

      observacoes,

      status,
pdf: {
  versao: 1,
},

compartilhamentos: {
  chat: false,
  whatsapp: false,
  email: false,
  download: false,
},
      layout: {
        tema:
          layout.tema || 'padrao',

        mostrarFoto:
          layout.mostrarFoto ?? true,

        mostrarEndereco:
          layout.mostrarEndereco ?? false,

        mostrarTelefone:
          layout.mostrarTelefone ?? true,

        assinaturaFonte:
          layout.assinaturaFonte ||
          'elegante',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Orçamento criado com sucesso.',
      orcamento: novo,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: 'Erro ao criar orçamento.',
      details: err.message,
    });
  }
};

/* =====================================================
   LISTAR
===================================================== */

exports.listarOrcamentos = async (req, res) => {
  try {

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.',
      });
    }

    const profissional = await Profissional.findOne({
      userId,
    });

    if (!profissional) {
      return res.status(404).json({
        error: 'Profissional não encontrado.',
      });
    }

    const {
      status,
      favorito,
      busca,
    } = req.query;

    const filtro = {
      profissionalId: profissional._id,
      ativo: true,
      deletedAt: null,
    };

    if (status) {
      filtro.status = status;
    }

    if (favorito !== undefined) {
      filtro.favorito = favorito === 'true';
    }

    if (busca) {
      filtro.$or = [
        {
          titulo: {
            $regex: busca,
            $options: 'i',
          },
        },
        {
          numero: {
            $regex: busca,
            $options: 'i',
          },
        },
        {
          'cliente.nome': {
            $regex: busca,
            $options: 'i',
          },
        },
      ];
    }

    const lista = await Orcamento.find(filtro)
      .sort({
        createdAt: -1,
      });

 return res.json({
  success: true,
  total: lista.length,
  orcamentos: lista,
});

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: 'Erro ao listar orçamentos.',
    });

  }
};


/* =====================================================
   BUSCAR
===================================================== */

exports.buscarOrcamento = async (req, res) => {

  try {

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.',
      });
    }

    const profissional = await Profissional.findOne({
      userId,
    });

    if (!profissional) {
      return res.status(404).json({
        error: 'Profissional não encontrado.',
      });
    }

    const { id } = req.params;

    const orcamento =
      await Orcamento.findOne({

        _id:id,

        profissionalId:profissional._id,

        ativo:true,

        deletedAt:null

      });

    if(!orcamento){

      return res.status(404).json({

        error:'Orçamento não encontrado.'

      });

    }

  return res.json({
  success: true,
  orcamento,
});

  }catch(err){

    console.error(err);

    return res.status(500).json({

      error:'Erro ao buscar orçamento.'

    });

  }

};


/* =====================================================
   ATUALIZAR
===================================================== */

exports.atualizarOrcamento = async (req,res)=>{

try{

const userId=getUserId(req);

if(!userId){

return res.status(401).json({

error:'Usuário não autenticado.'

});

}

const profissional=await Profissional.findOne({

userId

});

if(!profissional){

return res.status(404).json({

error:'Profissional não encontrado.'

});

}

const {id}=req.params;

const orcamento=await Orcamento.findOne({

_id:id,

profissionalId:profissional._id,

ativo:true,

deletedAt:null

});

if(!orcamento){

return res.status(404).json({

error:'Orçamento não encontrado.'

});

}

const{

titulo,

cliente,

clienteId,

itens=[],

desconto=0,

acrescimo=0,

formaPagamento,

validade,

observacoes,

layout,

status

}=req.body;

/* ======================
RECALCULA
====================== */

let subtotal=0;

const itensAtualizados=itens.map(item=>{

const quantidade=Number(item.quantidade||1);

const valorUnitario=Number(item.valorUnitario||0);

const descontoItem=Number(item.desconto||0);

const subtotalItem=

(quantidade*valorUnitario)-descontoItem;

subtotal+=subtotalItem;

return{

descricao:item.descricao,

quantidade,

valorUnitario,

desconto:descontoItem,

subtotal:subtotalItem

};

});

orcamento.titulo=titulo;

orcamento.clienteId=clienteId||null;

orcamento.cliente = {
  nome: cliente?.nome || '',
  telefone: cliente?.telefone || '',
  email: cliente?.email || '',
  endereco: cliente?.endereco || '',
};

orcamento.itens=itensAtualizados;

orcamento.subtotal=subtotal;

orcamento.desconto=Number(desconto);

orcamento.acrescimo=Number(acrescimo);

orcamento.total=

subtotal-

Number(desconto)+

Number(acrescimo);

orcamento.formaPagamento=formaPagamento;

orcamento.validade=validade;

orcamento.observacoes=observacoes;

if(layout){

orcamento.layout={

...orcamento.layout,

...layout

};

}

if(status){

orcamento.status=status;

}

await orcamento.save();

return res.json({

success:true,

message:'Orçamento atualizado.',

orcamento

});

}catch(err){

console.error(err);

return res.status(500).json({

error:'Erro ao atualizar orçamento.'

});

}

};

/* =====================================================
   EXCLUIR (SOFT DELETE)
===================================================== */

exports.excluirOrcamento = async (req, res) => {
  try {

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.',
      });
    }

    const profissional = await Profissional.findOne({
      userId,
    });

    if (!profissional) {
      return res.status(404).json({
        error: 'Profissional não encontrado.',
      });
    }

    const { id } = req.params;

    const orcamento = await Orcamento.findOne({
      _id: id,
      profissionalId: profissional._id,
      ativo: true,
      deletedAt: null,
    });

    if (!orcamento) {
      return res.status(404).json({
        error: 'Orçamento não encontrado.',
      });
    }

    orcamento.ativo = false;
    orcamento.deletedAt = new Date();

    await orcamento.save();

    return res.json({
      success: true,
      message: 'Orçamento excluído.',
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: 'Erro ao excluir orçamento.',
    });

  }
};


/* =====================================================
   DUPLICAR
===================================================== */

exports.duplicarOrcamento = async (req, res) => {

  try {

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.',
      });
    }

    const profissional = await Profissional.findOne({
      userId,
    });

    if (!profissional) {
      return res.status(404).json({
        error: 'Profissional não encontrado.',
      });
    }

    const { id } = req.params;

    const original = await Orcamento.findOne({
      _id: id,
      profissionalId: profissional._id,
      ativo: true,
      deletedAt: null,
    });

    if (!original) {
      return res.status(404).json({
        error: 'Orçamento não encontrado.',
      });
    }

    const numero =
      await gerarNumeroDocumento('ORC');

    const copia = original.toObject();

  delete copia._id;
delete copia.__v;
delete copia.createdAt;
delete copia.updatedAt;

    copia.numero = numero;
    copia.status = 'rascunho';
    copia.compartilhamentos = {
      chat: false,
      whatsapp: false,
      email: false,
      download: false,
    };

    copia.pdf = {
      versao: 1,
    };

    const novo =
      await Orcamento.create(copia);

    return res.status(201).json({

      success: true,

      message: 'Orçamento duplicado.',

      orcamento: novo,

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      error: 'Erro ao duplicar orçamento.',

    });

  }

};


/* =====================================================
   COMPARTILHAR
===================================================== */

exports.compartilharOrcamento = async (
  req,
  res
) => {

  try {

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.',
      });
    }

    const profissional =
      await Profissional.findOne({
        userId,
      });

    if (!profissional) {
      return res.status(404).json({
        error: 'Profissional não encontrado.',
      });
    }

    const { orcamentoId } = req.params;

    const {
      destino,
    } = req.body;

    const orcamento =
      await Orcamento.findOne({

        _id:id,

        profissionalId:profissional._id,

        ativo:true,

        deletedAt:null

      });

    if(!orcamento){

      return res.status(404).json({

        error:'Orçamento não encontrado.'

      });

    }

    switch(destino){

      case 'chat':
        orcamento.compartilhamentos.chat=true;
        break;

      case 'whatsapp':
        orcamento.compartilhamentos.whatsapp=true;
        break;

      case 'email':
        orcamento.compartilhamentos.email=true;
        break;

      case 'download':
        orcamento.compartilhamentos.download=true;
        break;
default:
  return res.status(400).json({
    error: 'Destino inválido.',
  });
    }

  if (destino !== 'download') {
  orcamento.status = 'compartilhado';
}

    await orcamento.save();

    return res.json({

      success:true,

      message:'Compartilhamento registrado.',

      compartilhamentos:
      orcamento.compartilhamentos,

      orcamento

    });

  }catch(err){

    console.error(err);

    return res.status(500).json({

      error:'Erro ao compartilhar orçamento.'

    });

  }

};
/* ============================================================
   GERAR PDF
============================================================ */

/* ============================================================
   GERAR PDF
============================================================ */

exports.gerarPdf = async (req, res) => {

  try {

    const { orcamentoId } = req.params;

    const orcamento = await Orcamento.findById(
      orcamentoId
    );

    if (!orcamento) {

      return res.status(404).json({

        success: false,

        message: 'Orçamento não encontrado.',

      });

    }

    // ⬇️ COLE A PARTE 2 AQUI
console.log('Iniciando geração do PDF...');
    const resultado = await gerarOrcamentoPdf(
      orcamento._id
    );
console.log('PDF gerado com sucesso.');
console.log('RESULTADO PDF');
console.log(resultado);
    orcamento.pdf = {

      ...(orcamento.pdf || {}),

      url: resultado.url,

      publicId: resultado.publicId,

      bytes: resultado.bytes,

      format: resultado.format,

      geradoEm: new Date(),

      versao:
        (orcamento.pdf?.versao || 0) + 1,

    };

  console.log('Antes do save');

await orcamento.save();

console.log('Depois do save');
console.log('Enviando resposta');
   return res.json({

  success: true,

  message: 'PDF gerado com sucesso.',

  pdfUrl: resultado.url,

  pdfPath: resultado.caminho,

  orcamento,

});

  } catch (erro) {

   console.error('======================');
console.error('ERRO GERAR PDF');
console.error(erro);
console.error(erro.stack);
console.error('======================');

    return res.status(500).json({

      success: false,

      message: 'Erro ao gerar PDF.',

      error: erro.message,

    });

  }

};