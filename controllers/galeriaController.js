const mongoose = require('mongoose');
const Galeria = require('../models/Galeria');

/* =========================================================
UTILITÁRIOS
========================================================= */

const obterProfissionalId = (req) => {
  return req.user?.id || req.user?._id || null;
};

const idValido = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const normalizarTitulo = (titulo) => {
  if (typeof titulo !== 'string') return '';

  return titulo.trim();
};

const normalizarUrl = (url) => {
  if (typeof url !== 'string') return '';

  return url.trim();
};


/* =========================================================
CRIAR DESTAQUE

POST /api/galeria

BODY:

{
  "titulo": "Massagens",
  "capa": "url-opcional",
  "fotos": [
    {
      "url": "url-foto"
    }
  ]
}
========================================================= */

exports.criarDestaque = async (req, res, next) => {
  try {
    const profissionalId = obterProfissionalId(req);
console.log('CRIANDO DESTAQUE PARA:', profissionalId);
    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }

    const titulo = normalizarTitulo(req.body?.titulo);

    const capa = normalizarUrl(req.body?.capa);

    const fotosRecebidas = Array.isArray(req.body?.fotos)
      ? req.body.fotos
      : [];

    if (!titulo) {
      return res.status(400).json({
        message: 'O nome do destaque é obrigatório.',
      });
    }

    if (titulo.length > 30) {
      return res.status(400).json({
        message:
          'O nome do destaque deve ter no máximo 30 caracteres.',
      });
    }

    const fotos = fotosRecebidas
      .map((foto, index) => {
        /*
        Permite receber:

        "url-da-foto"

        OU

        {
          url: "url-da-foto",
          descricao: "Descrição"
        }
        */

        if (typeof foto === 'string') {
          return {
            url: normalizarUrl(foto),
            descricao: '',
            ordem: index,
          };
        }

        return {
          url: normalizarUrl(foto?.url),
          descricao:
            typeof foto?.descricao === 'string'
              ? foto.descricao.trim()
              : '',
          ordem:
            Number.isFinite(Number(foto?.ordem))
              ? Number(foto.ordem)
              : index,
        };
      })
      .filter((foto) => foto.url);

    /*
    Limite para evitar destaques gigantes.
    Podemos aumentar futuramente.
    */

    if (fotos.length > 20) {
      return res.status(400).json({
        message:
          'Cada destaque pode possuir no máximo 20 fotos.',
      });
    }

    /*
    Descobre a próxima ordem automaticamente.
    */

    const ultimoDestaque = await Galeria.findOne({
      profissional: profissionalId,
    })
      .sort({ ordem: -1 })
      .select('ordem')
      .lean();

    const proximaOrdem =
      Number(ultimoDestaque?.ordem || 0) + 1;

    /*
    Se não veio uma capa,
    utiliza automaticamente a primeira foto.
    */

    const capaFinal =
      capa ||
      fotos?.[0]?.url ||
      null;

    const destaque = await Galeria.create({
      profissional: profissionalId,

      titulo,

      capa: capaFinal,

      fotos,

      ordem: proximaOrdem,

      ativo: true,
    });

    return res.status(201).json({
      message: 'Destaque criado com sucesso.',
      destaque,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
LISTAR MEUS DESTAQUES

GET /api/galeria/me
========================================================= */

exports.listarMeusDestaques = async (
  req,
  res,
  next
) => {
  try {
    const profissionalId = obterProfissionalId(req);

    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }
console.log('REQ.USER GALERIA:', req.user);
console.log('PROFISSIONAL ID GALERIA:', profissionalId);
    const destaques = await Galeria.find({
      profissional: profissionalId,
    })
      .sort({
        ordem: 1,
        createdAt: -1,
      })
      .lean();

    return res.json({
      destaques,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
LISTAR DESTAQUES PÚBLICOS

GET /api/galeria/profissional/:profissionalId
========================================================= */

exports.listarDestaquesPublicos = async (
  req,
  res,
  next
) => {
  try {
    const { profissionalId } = req.params;

    if (!idValido(profissionalId)) {
      return res.status(400).json({
        message: 'ID do profissional inválido.',
      });
    }

    const destaques = await Galeria.find({
      profissional: profissionalId,
      ativo: true,
    })
      .sort({
        ordem: 1,
        createdAt: -1,
      })
      .lean();

    return res.json({
      destaques,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
BUSCAR UM DESTAQUE DO PRÓPRIO PROFISSIONAL

GET /api/galeria/:id
========================================================= */

exports.buscarMeuDestaque = async (
  req,
  res,
  next
) => {
  try {
    const profissionalId = obterProfissionalId(req);

    const { id } = req.params;

    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }

    if (!idValido(id)) {
      return res.status(400).json({
        message: 'ID do destaque inválido.',
      });
    }

    const destaque = await Galeria.findOne({
      _id: id,
      profissional: profissionalId,
    }).lean();

    if (!destaque) {
      return res.status(404).json({
        message: 'Destaque não encontrado.',
      });
    }

    return res.json({
      destaque,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
EDITAR DESTAQUE

PUT /api/galeria/:id

BODY POSSÍVEL:

{
  "titulo": "Novo nome",
  "ativo": true,
  "ordem": 2
}
========================================================= */

exports.editarDestaque = async (
  req,
  res,
  next
) => {
  try {
    const profissionalId = obterProfissionalId(req);

    const { id } = req.params;

    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }

    if (!idValido(id)) {
      return res.status(400).json({
        message: 'ID do destaque inválido.',
      });
    }

    const destaque = await Galeria.findOne({
      _id: id,
      profissional: profissionalId,
    });

    if (!destaque) {
      return res.status(404).json({
        message: 'Destaque não encontrado.',
      });
    }

    /*
    TÍTULO
    */

    if (req.body?.titulo !== undefined) {
      const titulo = normalizarTitulo(
        req.body.titulo
      );

      if (!titulo) {
        return res.status(400).json({
          message:
            'O nome do destaque não pode ficar vazio.',
        });
      }

      if (titulo.length > 30) {
        return res.status(400).json({
          message:
            'O nome do destaque deve ter no máximo 30 caracteres.',
        });
      }

      destaque.titulo = titulo;
    }

    /*
    ATIVO
    */

    if (typeof req.body?.ativo === 'boolean') {
      destaque.ativo = req.body.ativo;
    }

    /*
    ORDEM
    */

    if (
      req.body?.ordem !== undefined &&
      Number.isFinite(Number(req.body.ordem))
    ) {
      destaque.ordem = Number(req.body.ordem);
    }

    await destaque.save();

    return res.json({
      message: 'Destaque atualizado com sucesso.',
      destaque,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
ADICIONAR FOTOS

POST /api/galeria/:id/fotos

BODY:

{
  "fotos": [
    {
      "url": "url-foto"
    }
  ]
}
========================================================= */

exports.adicionarFotos = async (
  req,
  res,
  next
) => {
  try {
    const profissionalId = obterProfissionalId(req);

    const { id } = req.params;

    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }

    if (!idValido(id)) {
      return res.status(400).json({
        message: 'ID do destaque inválido.',
      });
    }

    const destaque = await Galeria.findOne({
      _id: id,
      profissional: profissionalId,
    });

    if (!destaque) {
      return res.status(404).json({
        message: 'Destaque não encontrado.',
      });
    }

    const fotosRecebidas = Array.isArray(
      req.body?.fotos
    )
      ? req.body.fotos
      : [];

    const novasFotos = fotosRecebidas
      .map((foto, index) => {
        if (typeof foto === 'string') {
          return {
            url: normalizarUrl(foto),
            descricao: '',
            ordem:
              destaque.fotos.length + index,
          };
        }

        return {
          url: normalizarUrl(foto?.url),

          descricao:
            typeof foto?.descricao === 'string'
              ? foto.descricao.trim()
              : '',

          ordem:
            destaque.fotos.length + index,
        };
      })
      .filter((foto) => foto.url);

    if (!novasFotos.length) {
      return res.status(400).json({
        message:
          'Envie pelo menos uma foto válida.',
      });
    }

    const totalFinal =
      destaque.fotos.length +
      novasFotos.length;

    if (totalFinal > 20) {
      return res.status(400).json({
        message:
          'Cada destaque pode possuir no máximo 20 fotos.',
      });
    }

    destaque.fotos.push(...novasFotos);

    /*
    Se o destaque ainda não tem capa,
    usa a primeira foto adicionada.
    */

    if (!destaque.capa) {
      destaque.capa = novasFotos[0].url;
    }

    await destaque.save();

    return res.status(201).json({
      message: 'Fotos adicionadas com sucesso.',
      destaque,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
REMOVER FOTO

DELETE /api/galeria/:id/fotos/:fotoId
========================================================= */

exports.removerFoto = async (
  req,
  res,
  next
) => {
  try {
    const profissionalId = obterProfissionalId(req);

    const { id, fotoId } = req.params;

    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }

    if (!idValido(id) || !idValido(fotoId)) {
      return res.status(400).json({
        message: 'ID inválido.',
      });
    }

    const destaque = await Galeria.findOne({
      _id: id,
      profissional: profissionalId,
    });

    if (!destaque) {
      return res.status(404).json({
        message: 'Destaque não encontrado.',
      });
    }

    const foto = destaque.fotos.id(fotoId);

    if (!foto) {
      return res.status(404).json({
        message: 'Foto não encontrada.',
      });
    }

    const urlFotoRemovida = foto.url;

    foto.deleteOne();

    /*
    Se a foto removida era a capa,
    escolhe automaticamente a próxima.
    */

    if (destaque.capa === urlFotoRemovida) {
      destaque.capa =
        destaque.fotos?.[0]?.url ||
        null;
    }

    await destaque.save();

    return res.json({
      message: 'Foto removida com sucesso.',
      destaque,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
ALTERAR CAPA

PUT /api/galeria/:id/capa

BODY:

{
  "fotoId": "ID-DA-FOTO"
}

OU

{
  "url": "URL-DA-FOTO"
}
========================================================= */

exports.alterarCapa = async (
  req,
  res,
  next
) => {
  try {
    const profissionalId = obterProfissionalId(req);

    const { id } = req.params;

    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }

    if (!idValido(id)) {
      return res.status(400).json({
        message: 'ID do destaque inválido.',
      });
    }

    const destaque = await Galeria.findOne({
      _id: id,
      profissional: profissionalId,
    });

    if (!destaque) {
      return res.status(404).json({
        message: 'Destaque não encontrado.',
      });
    }

    const { fotoId } = req.body;

    const urlRecebida = normalizarUrl(
      req.body?.url
    );

    let novaCapa = null;

    /*
    ALTERAÇÃO POR ID DA FOTO
    */

    if (fotoId) {
      if (!idValido(fotoId)) {
        return res.status(400).json({
          message: 'ID da foto inválido.',
        });
      }

      const foto = destaque.fotos.id(fotoId);

      if (!foto) {
        return res.status(404).json({
          message:
            'A foto selecionada não pertence a este destaque.',
        });
      }

      novaCapa = foto.url;
    }

    /*
    ALTERAÇÃO POR URL

    Só permite URL que já pertença
    ao próprio destaque.
    */

    if (!novaCapa && urlRecebida) {
      const fotoExiste = destaque.fotos.some(
        (foto) => foto.url === urlRecebida
      );

      if (!fotoExiste) {
        return res.status(400).json({
          message:
            'A capa deve ser uma foto pertencente ao destaque.',
        });
      }

      novaCapa = urlRecebida;
    }

    if (!novaCapa) {
      return res.status(400).json({
        message:
          'Selecione uma foto válida para a capa.',
      });
    }

    destaque.capa = novaCapa;

    await destaque.save();

    return res.json({
      message: 'Capa alterada com sucesso.',
      destaque,
    });
  } catch (err) {
    next(err);
  }
};


/* =========================================================
EXCLUIR DESTAQUE

DELETE /api/galeria/:id
========================================================= */

exports.excluirDestaque = async (
  req,
  res,
  next
) => {
  try {
    const profissionalId = obterProfissionalId(req);

    const { id } = req.params;

    if (!profissionalId) {
      return res.status(401).json({
        message: 'Usuário não autenticado.',
      });
    }

    if (!idValido(id)) {
      return res.status(400).json({
        message: 'ID do destaque inválido.',
      });
    }

    const destaque = await Galeria.findOneAndDelete({
      _id: id,
      profissional: profissionalId,
    });

    if (!destaque) {
      return res.status(404).json({
        message: 'Destaque não encontrado.',
      });
    }

    return res.json({
      message: 'Destaque excluído com sucesso.',
    });
  } catch (err) {
    next(err);
  }
};