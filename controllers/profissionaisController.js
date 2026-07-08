// backend/controllers/profissionaisController.js

const mongoose = require('mongoose');
const Avaliacao = require('../models/Avaliacao');
const Profissional = require('../models/Profissional');
const User = require('../models/user');
const Order = require('../models/order');
const scoreEvents = require("../services/scoreEvents");
const Servico = require('../models/Servico');
const activityEngine = require("../services/tanaEngine/activityEngine");
const {
  calculateSearchScore,
} = require("../services/searchScoreService");
const {
  getCityRanking,
  getProfessionRanking,
  getDistanceToLeader,
} = require("../services/RankingService");
const {
  generateSeals,
} = require("../services/tanaSealService");
const {
  sortProfessionalsByMatch,
  generateMatchStats,
} = require("../services/tanaMatchService");
const {
  getCurrentSeason,
  isEligible,
  getReward,
} = require("../services/seasonService");
const SERVICOS_SOCORRO_VALIDOS = [
  'pneu_furado',
  'bateria_descarregada',
  'guincho',
  'sem_combustivel',
  'pane_eletrica',
  'problema_motor',
];

/* ============================================================================ 
 * HELPERS
 * ========================================================================== */

const getUserId = (req) => {
  const decoded = req.user || {};

  const id =
    decoded.userId ||
    decoded.sub ||
    decoded.id ||
    decoded._id;

  if (!id) return null;

  return id.toString();
};

const resolveProfByUserIdOrId = async (id) => {
  if (!id) return null;

  let prof = await Profissional.findOne({ userId: id }).lean();
  if (prof) return prof;

  if (mongoose.Types.ObjectId.isValid(id)) {
    prof = await Profissional.findById(id).lean();
    if (prof) return prof;
  }

  return null;
};

/* ============================================================================ 
 * RESUMO
 * ========================================================================== */

exports.getResumoProfissionalLogado = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId)
      return res.status(401).json({ ok: false, message: 'Não autenticado' });

    const atendimentoAtivo = await Order.exists({
      profissionalId: userId,
      status: { $in: ['aceito', 'em_andamento'] },
    });

    return res.json({
      ok: true,
      data: {
        emAtendimentoAtivo: Boolean(atendimentoAtivo),
      },
    });
  } catch (e) {
    console.error('profissionais.getResumoProfissionalLogado:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao gerar resumo do profissional',
    });
  }
};

/* ============================================================================ 
 * LISTAGEM
 * ========================================================================== */

exports.list = async (req, res) => {
  try {
    const {
      categoriaId,
      profissaoId,
      cidade,
      tipoAtendimento,
      servicoEmergencial,
      query,
      latitude,
      longitude,
      urgente,
      immediate,
    } = req.query;

    /* ============================================================
       FILTROS
    ============================================================ */

    const filtrosPrincipais = [];

    /* ============================================================
       SOCORRO AUTOMOTIVO
    ============================================================ */

    if (req.query.socorristaAutomotivo === 'true') {
      filtrosPrincipais.push({
        socorristaAutomotivo: true,
      });

      if (servicoEmergencial) {
        filtrosPrincipais.push({
          servicosSocorroAutomotivo: servicoEmergencial,
        });
      }
    } else {
      /* ============================================================
         FILTRO POR CATEGORIA / PROFISSÃO
         SUPORTA:
         • formato antigo
         • profissões múltiplas
      ============================================================ */

    /* ============================================================
   FILTRO POR CATEGORIA / PROFISSÃO

   SUPORTA:

   • formato antigo
   • profissão principal
   • profissões múltiplas
   • somente categoria
   • somente profissão
   • categoria + profissão
============================================================ */

if (categoriaId || profissaoId) {
  /* ============================
     VALIDAÇÃO DOS IDS
  ============================ */

  if (
    categoriaId &&
    !mongoose.Types.ObjectId.isValid(categoriaId)
  ) {
    return res.status(400).json({
      ok: false,
      message: 'categoriaId inválido',
    });
  }

  if (
    profissaoId &&
    !mongoose.Types.ObjectId.isValid(profissaoId)
  ) {
    return res.status(400).json({
      ok: false,
      message: 'profissaoId inválido',
    });
  }

  /* ============================
     CONVERSÃO DOS IDS
  ============================ */

  const categoriaObjectId = categoriaId
    ? new mongoose.Types.ObjectId(categoriaId)
    : null;

  const profissaoObjectId = profissaoId
    ? new mongoose.Types.ObjectId(profissaoId)
    : null;

  /* ============================
     FILTROS DE COMPATIBILIDADE
  ============================ */

  const filtrosCompatibilidade = [];

  /* ============================================================
     CASO 1
     CATEGORIA + PROFISSÃO

     Exemplo:

     Saúde
     +
     Massoterapeuta

     Procura:

     • profissão principal antiga

     OU

     • uma das profissões múltiplas

     $elemMatch garante que categoria
     e profissão pertençam ao MESMO
     item de profissoesDetalhadas.
  ============================================================ */

  if (
    categoriaObjectId &&
    profissaoObjectId
  ) {
    filtrosCompatibilidade.push(
      {
        categoriaId:
          categoriaObjectId,

        profissaoId:
          profissaoObjectId,
      },

      {
        profissoesDetalhadas: {
          $elemMatch: {
            categoriaId:
              categoriaObjectId,

            profissaoId:
              profissaoObjectId,
          },
        },
      }
    );
  }

  /* ============================================================
     CASO 2
     SOMENTE CATEGORIA

     O profissional aparece se:

     • categoria principal corresponde

     OU

     • qualquer uma das 3 profissões
       pertence à categoria
  ============================================================ */

  else if (categoriaObjectId) {
    filtrosCompatibilidade.push(
      {
        categoriaId:
          categoriaObjectId,
      },

      {
        profissoesDetalhadas: {
          $elemMatch: {
            categoriaId:
              categoriaObjectId,
          },
        },
      }
    );
  }

  /* ============================================================
     CASO 3
     SOMENTE PROFISSÃO

     O profissional aparece se:

     • profissão principal corresponde

     OU

     • qualquer uma das 3 profissões
       corresponde
  ============================================================ */

  else if (profissaoObjectId) {
    filtrosCompatibilidade.push(
      {
        profissaoId:
          profissaoObjectId,
      },

      {
        profissoesDetalhadas: {
          $elemMatch: {
            profissaoId:
              profissaoObjectId,
          },
        },
      }
    );
  }

  /* ============================================================
     AGRUPAMENTO FINAL

     O profissional precisa corresponder
     a pelo menos UMA das estruturas:

     • formato principal

     OU

     • profissões múltiplas
  ============================================================ */

  if (filtrosCompatibilidade.length === 1) {
    filtrosPrincipais.push(
      filtrosCompatibilidade[0]
    );
  } else if (
    filtrosCompatibilidade.length > 1
  ) {
    filtrosPrincipais.push({
      $or: filtrosCompatibilidade,
    });
  }
}

/* FECHA O ELSE DO SOCORRISTA AUTOMOTIVO */
}

/* ============================================================
   BUSCA TEXTUAL INTELIGENTE

   Exemplos suportados:

   • Marcela
   • Roni pintor
   • pintor
   • massagem relaxante
   • Marcela massagem

   A busca encontra candidatos por:
   • nome
   • profissão principal
   • profissões
   • profissões detalhadas
   • serviços cadastrados
============================================================ */

const searchQuery = String(query || '')
  .trim()
  .replace(/\s+/g, ' ');

if (searchQuery) {
  /* ============================
     ESCAPA CARACTERES DE REGEX
  ============================ */

  const escapeRegex = (value) =>
    String(value).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

  /* ============================
     SEPARA A BUSCA EM TERMOS

     "Roni pintor"
     →
     ["Roni", "pintor"]
  ============================ */

  const searchTerms = searchQuery
    .split(' ')
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);

  /* ============================
     CADA TERMO PRECISA APARECER
     EM PELO MENOS UM CAMPO

     Exemplo:

     Roni → name
     pintor → profissão

     Isso permite busca combinada.
  ============================ */

  const filtrosPorTermo =
    searchTerms.map((term) => {
      const regex = new RegExp(
        escapeRegex(term),
        'i'
      );

      return {
        $or: [
          {
            name: regex,
          },

          {
            profissaoNome: regex,
          },

          {
            profissoes: regex,
          },

          {
            'profissoesDetalhadas.nome':
              regex,
          },

          {
            'profissoesDetalhadas.categoriaNome':
              regex,
          },

          {
            'servicos.nome': regex,
          },
        ],
      };
    });

  if (filtrosPorTermo.length === 1) {
    filtrosPrincipais.push(
      filtrosPorTermo[0]
    );
  } else if (filtrosPorTermo.length > 1) {
    filtrosPrincipais.push({
      $and: filtrosPorTermo,
    });
  }
}
    /* ============================================================
       FILTRO AUTOMÁTICO POR CIDADE

       IMPORTANTE:

       Antes o filtro de cidade sobrescrevia o $or
       de profissão/categoria.

       Agora utilizamos $and para preservar ambos.
    ============================================================ */

    const userId = getUserId(req);

    if (userId) {
      const usuario = await User.findById(userId)
        .select('cidadeSlug')
        .lean();

      if (usuario?.cidadeSlug) {
        filtrosPrincipais.push({
          $or: [
            {
              'endereco.cidadeSlug':
                usuario.cidadeSlug,
            },
            {
              'endereco.cidade': new RegExp(
                `^${usuario.cidadeSlug
                  .replace(/-/g, ' ')
                  .replace(
                    /\b\w/g,
                    (letter) =>
                      letter.toUpperCase()
                  )}$`,
                'i'
              ),
            },
          ],
        });
      }
    } else if (cidade) {
      filtrosPrincipais.push({
        'endereco.cidadeSlug': String(cidade)
          .trim()
          .toLowerCase(),
      });
    }

    /* ============================================================
       TIPO DE ATENDIMENTO
    ============================================================ */

    if (tipoAtendimento) {
      filtrosPrincipais.push({
        [`tipoAtendimento.${tipoAtendimento}`]: true,
      });
    }
console.log(
  '[Busca Inteligente] QUERY:',
  searchQuery || null
);

console.log(
  '[Busca Inteligente] TERMOS:',
  searchQuery
    ? searchQuery.split(' ')
    : []
);
    /* ============================================================
       FILTRO FINAL
    ============================================================ */

    let filtro = {};

    if (filtrosPrincipais.length === 1) {
      filtro = filtrosPrincipais[0];
    } else if (filtrosPrincipais.length > 1) {
      filtro = {
        $and: filtrosPrincipais,
      };
    }

    console.log(
      '[TanaMatch] FILTRO FINAL:',
      JSON.stringify(filtro, null, 2)
    );

    /* ============================================================
       BUSCA DOS PROFISSIONAIS
    ============================================================ */

    const profs = await Profissional.find(filtro)
      .populate({
        path: 'userId',
        select: 'acessoExpiraEm online',
      })
      .lean();

    console.log(
      '[TanaMatch] PROFISSIONAIS ENCONTRADOS:',
      profs.length
    );

    /* ============================================================
       FILTRO DE PLANO ATIVO
    ============================================================ */

    const agora = new Date();

    const filtrados = profs.filter((p) => {
      const user = p.userId;

      if (!user) return false;

      if (!user.acessoExpiraEm) {
        return false;
      }

      if (user.acessoExpiraEm < agora) {
        return false;
      }

      return true;
    });

    console.log(
      '[TanaMatch] PROFISSIONAIS COM PLANO ATIVO:',
      filtrados.length
    );

    /* ============================================================
       IDS PARA BUSCA DAS AVALIAÇÕES
    ============================================================ */

    const idsProfissional = filtrados.map(
      (p) => p._id
    );

    const idsUser = filtrados
      .map(
        (p) =>
          p.userId?._id ||
          p.userId
      )
      .filter(Boolean);

    /* ============================================================
       MÉTRICAS REAIS DE AVALIAÇÃO
    ============================================================ */

    const metricas =
      idsProfissional.length > 0
        ? await Avaliacao.aggregate([
            {
              $match: {
                origem: {
                  $in: [
                    'profissional',
                    'servico',
                    'pedido',
                  ],
                },

                $or: [
                  {
                    profissionalId: {
                      $in: idsProfissional,
                    },
                  },

                  {
                    profissionalUserId: {
                      $in: idsUser,
                    },
                  },

                  {
                    profissional: {
                      $in: idsUser,
                    },
                  },

                  {
                    prestadorId: {
                      $in: idsProfissional,
                    },
                  },
                ],
              },
            },

            {
              $project: {
                nota: 1,

                chave: {
                  $ifNull: [
                    '$profissionalId',

                    {
                      $ifNull: [
                        '$prestadorId',

                        {
                          $ifNull: [
                            '$profissionalUserId',
                            '$profissional',
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },

            {
              $group: {
                _id: '$chave',

                mediaAvaliacoes: {
                  $avg: '$nota',
                },

                totalAvaliacoes: {
                  $sum: 1,
                },
              },
            },
          ])
        : [];

    /* ============================================================
       MAPA DE MÉTRICAS
    ============================================================ */

    const mapaMetricas = new Map(
      metricas.map((m) => [
        String(m._id),

        {
          mediaAvaliacoes: Number(
            m.mediaAvaliacoes || 0
          ),

          totalAvaliacoes:
            m.totalAvaliacoes || 0,
        },
      ])
    );

    /* ============================================================
       PREPARAÇÃO DOS PROFISSIONAIS

       IMPORTANTE:

       O online real vem do User populado.

       O TanaMatch precisa receber esse valor
       diretamente no objeto do profissional.
    ============================================================ */

    const profissionaisPreparados =
      filtrados.map((p) => {
        const profId = String(p._id);

        const professionalUserId = String(
          p.userId?._id ||
          p.userId ||
          ''
        );

        const metrics =
          mapaMetricas.get(profId) ||
          mapaMetricas.get(
            professionalUserId
          ) || {
            mediaAvaliacoes: 0,
            totalAvaliacoes: 0,
          };

        const profissional = {
          ...p,

          /* ============================
             MÉTRICAS REAIS
          ============================ */

          metrics: {
            ...(p.metrics || {}),
            ...metrics,
          },

          /* ============================
             ONLINE REAL

             No sistema atual o online
             pode vir do User.
          ============================ */

          online:
            p.userId?.online ??
            p.online ??
            false,
        };

        /* ============================
           SEARCHSCORE

           Mantemos funcionando.
        ============================ */

        profissional.searchScore =
          calculateSearchScore(
            profissional
          );

        return profissional;
      });

    /* ============================================================
       CONTEXTO DO TANAMATCH™

       Representa a necessidade atual do cliente.
    ============================================================ */

    const tanaMatchContext = {
      categoriaId:
        categoriaId || null,

      profissaoId:
        profissaoId || null,

     query: null,

      servicoEmergencial:
        servicoEmergencial || null,

      latitude:
        latitude !== undefined
          ? Number(latitude)
          : undefined,

      longitude:
        longitude !== undefined
          ? Number(longitude)
          : undefined,

      urgente:
        urgente === true ||
        urgente === 'true',

      immediate:
        immediate === true ||
        immediate === 'true',

      socorristaAutomotivo:
        req.query
          .socorristaAutomotivo ===
        'true',
    };

    /* ============================================================
       TANAMATCH™

       ORDEM FINAL:

       1. TanaMatch
       2. SearchScore
       3. TanaScore
       4. Avaliação
       5. Quantidade de avaliações
    ============================================================ */

    const profissionais =
      sortProfessionalsByMatch(
        profissionaisPreparados,
        tanaMatchContext
      );

    /* ============================================================
       ESTATÍSTICAS

       Preparadas para:
       • TanaInsights
       • Dashboard
       • monitoramento do algoritmo

       Não altera o frontend atual.
    ============================================================ */

    const matchStats =
      generateMatchStats(profissionais);

    console.log(
      '[TanaMatch] CONTEXTO:',
      tanaMatchContext
    );

    console.log(
      '[TanaMatch] ESTATÍSTICAS:',
      matchStats
    );

    /* ============================================================
       RESPOSTA

       Mantemos exatamente:

       data: profissionais

       para não quebrar a ListaProfissionaisScreen.
    ============================================================ */

    return res.json({
      ok: true,

      data: profissionais,

      meta: {
        tanaMatch: true,

        total:
          profissionais.length,

        matchStats,
      },
    });
  } catch (e) {
    console.error(
      '[TanaMatch] profissionais.list:',
      e
    );

    return res.status(500).json({
      ok: false,
      message:
        'Erro ao listar profissionais',
    });
  }
};
/* ============================================================================
 * DETALHE
 * ========================================================================== */

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({
        ok: false,
        message: 'ID inválido'
      });

    const prof = await Profissional.findById(id)
      .populate({
        path: 'userId',
        select: 'acessoExpiraEm online'
      })
      .lean();

    if (!prof)
      return res.status(404).json({
        ok: false,
        message: 'Profissional não encontrado',
      });

    /* =========================
       MÉTRICAS REAIS
    ========================= */

    const profId = prof._id;
    const userId = prof.userId?._id || prof.userId;

    console.log('==============================');
    console.log('PERFIL PUBLICO');
    console.log('PROF ID:', String(profId));
    console.log('USER ID:', String(userId));

    const metricas = await Avaliacao.aggregate([
      {
        $match: {
          origem: { $in: ['profissional', 'servico', 'pedido'] },
          $or: [
            { profissionalId: profId },
            { profissionalUserId: userId },
            { profissional: userId },
            { prestadorId: profId },
          ],
        },
      },
      {
        $group: {
          _id: null,
          mediaAvaliacoes: { $avg: '$nota' },
          totalAvaliacoes: { $sum: 1 },
        },
      },
    ]);

    const servicos = await Servico.find({
      profissional: userId,
    }).select('status profissional');

    console.log('SERVICOS ENCONTRADOS:', servicos.length);

    const servicosFinalizados = servicos.filter(
      s => s.status === 'finalizado'
    ).length;

    console.log('FINALIZADOS:', servicosFinalizados);

    prof.metrics = {
      mediaAvaliacoes: Number(
        metricas?.[0]?.mediaAvaliacoes || 0
      ),

      totalAvaliacoes: Number(
        metricas?.[0]?.totalAvaliacoes || 0
      ),

      servicosFinalizados,
    };

    console.log('METRICS FINAL:', prof.metrics);

    /* =========================
   TANAPROFILE PREMIUM
========================= */

prof.searchScore =
  calculateSearchScore(prof);

const cityRanking =
  await getCityRanking(prof);

const professionRanking =
  await getProfessionRanking(prof);

prof.cityRanking = cityRanking;

prof.professionRanking =
  professionRanking;

prof.distanceLeader =
  await getDistanceToLeader(prof);

prof.tanaSeals =
  generateSeals(
    prof,
    cityRanking || {}
  );
const season =
  getCurrentSeason();

prof.season = season;

if (isEligible(prof)) {

prof.reward =
  cityRanking
    ? getReward(cityRanking.position)
    : null;

} else {

  prof.reward = null;

}
    /* =========================
       BLOQUEIO PLANO EXPIRADO
    ========================= */

    const user = prof.userId;

    if (
      !user ||
      !user.acessoExpiraEm ||
      user.acessoExpiraEm < new Date()
    ) {
      return res.status(404).json({
        ok: false,
        message: 'Profissional indisponível',
      });
    }

    // 🔥 PROFISSÕES (fallback)
    if (!prof.profissoes || !prof.profissoes.length) {
      if (Array.isArray(prof.especialidades)) {
        prof.profissoes = prof.especialidades;
      } else {
        prof.profissoes = [];
      }
    }

    // 🔥 GARANTIR CAMPOS PADRÃO
    prof.galeria = Array.isArray(prof.galeria) ? prof.galeria : [];
    prof.servicos = Array.isArray(prof.servicos) ? prof.servicos : [];
    prof.servicosSocorroAutomotivo = Array.isArray(prof.servicosSocorroAutomotivo)
  ? prof.servicosSocorroAutomotivo
  : [];
    prof.metrics = prof.metrics || {
      mediaAvaliacoes: 0,
      totalAvaliacoes: 0,
    };
    // online vem do USER
prof.online = prof.userId?.online ?? false;


// pagamentos vêm do PROFISSIONAL
prof.aceitaPix = prof.aceitaPix ?? false;
prof.aceitaCartao = prof.aceitaCartao ?? false;
prof.aceitaDinheiro = prof.aceitaDinheiro ?? false;

    res.set('Cache-Control', 'no-store');

    return res.json({
      ok: true,
      data: prof,
    });

  } catch (e) {
    console.error('profissionais.getById:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar profissional',
    });
  }
};
/* ============================================================================ 
 * UPDATE PERFIL (VERSÃO FINAL ESTÁVEL + GALERIA INTELIGENTE)
 * ========================================================================== */

exports.updateMe = async (req, res) => {
  try {
    console.log('BODY RECEBIDO:', req.body);

    const id = getUserId(req);

    if (!id) {
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado',
      });
    }

    let user = await User.findById(id);

    let prof = await Profissional.findOne({
      $or: [{ userId: id }, { _id: id }]
    });

    if (!prof) {
      prof = await Profissional.create({
        userId: id,
        name: user?.name || '',
        email: user?.email || '',
        password: user?.password || '',
        cpf: user?.cpf || '00000000000',
        phone: user?.phone || '00000000000',
      });
    }

    console.log('PROF COMPLETO:', prof);

    const updateData = {};

    /* ============================
       CAMPOS PRINCIPAIS
    ============================ */

    if (req.body.nomeCompleto !== undefined)
      updateData.name = req.body.nomeCompleto;

    if (req.body.bio !== undefined)
      updateData.bio = req.body.bio;

    if (req.body.telefone)
      updateData.phone = req.body.telefone;

    if (req.body.cpfCnpj)
      updateData.cpf = req.body.cpfCnpj;

    if (req.body.dataNascimento !== undefined)
      updateData.dataNascimento = req.body.dataNascimento;

    if (req.body.endereco && typeof req.body.endereco === 'object') {
  updateData.endereco = {
    ...req.body.endereco,

    cidadeSlug: String(req.body.endereco.cidade || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  };
}

    /* ============================
   PROFISSÕES
============================ */

if (Array.isArray(req.body.profissoesDetalhadas)) {
  const detalhadas = req.body.profissoesDetalhadas
    .slice(0, 3)
    .filter((item) => item && item.nome)
    .map((item) => ({
      profissaoId: mongoose.Types.ObjectId.isValid(item.profissaoId)
        ? item.profissaoId
        : undefined,

      nome: String(item.nome || '').trim(),

      categoriaId: mongoose.Types.ObjectId.isValid(item.categoriaId)
        ? item.categoriaId
        : undefined,

      categoriaNome: String(item.categoriaNome || '').trim(),
    }));

  updateData.profissoesDetalhadas = detalhadas;

  updateData.profissoes = detalhadas
    .map((item) => item.nome)
    .filter(Boolean);
// Mantém compatibilidade com o restante do sistema
const principal = detalhadas[0];

if (principal) {
  updateData.categoriaId = principal.categoriaId;
  updateData.profissaoId = principal.profissaoId;
  updateData.profissaoNome = principal.nome;
}
} else if (Array.isArray(req.body.profissoes)) {
  updateData.profissoes = req.body.profissoes
    .slice(0, 3)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

} else if (Array.isArray(req.body.especialidades)) {
  updateData.profissoes = req.body.especialidades
    .slice(0, 3)
    .map((item) => String(item || '').trim())
    .filter(Boolean);

} else if (req.body.profissaoNome) {
  updateData.profissoes = [req.body.profissaoNome];
}



if (req.body.tipoAtendimento !== undefined)
  updateData.tipoAtendimento = req.body.tipoAtendimento;
    /* ============================
       FLAGS
    ============================ */

    if (req.body.atendeEmergencia !== undefined)
      updateData.atendeEmergencia = req.body.atendeEmergencia;

    if (req.body.atendeFimSemana !== undefined)
      updateData.atendeFimSemana = req.body.atendeFimSemana;

    if (req.body.atende24h !== undefined)
      updateData.atende24h = req.body.atende24h;
    if (req.body.aceitaServicoImediato !== undefined)
  updateData.aceitaServicoImediato = req.body.aceitaServicoImediato;
    if (req.body.aceitaPix !== undefined)
  updateData.aceitaPix = req.body.aceitaPix;

if (req.body.aceitaCartao !== undefined)
  updateData.aceitaCartao = req.body.aceitaCartao;

if (req.body.aceitaDinheiro !== undefined)
  updateData.aceitaDinheiro = req.body.aceitaDinheiro;
/* ============================
   SOCORRISTA AUTOMOTIVO
============================ */

/* ============================
   SOCORRISTA AUTOMOTIVO
============================ */

if (req.body.socorristaAutomotivo !== undefined)
  updateData.socorristaAutomotivo = req.body.socorristaAutomotivo;

if (Array.isArray(req.body.servicosSocorroAutomotivo)) {
  updateData.servicosSocorroAutomotivo =
    req.body.servicosSocorroAutomotivo.filter((item) =>
      SERVICOS_SOCORRO_VALIDOS.includes(item)
    );
}

if (req.body.atendeFimSemana !== undefined)
  updateData.atendeFimSemana = req.body.atendeFimSemana;

if (req.body.atende24h !== undefined)
  updateData.atende24h = req.body.atende24h;
   /* ============================
   FOTO DE PERFIL E CAPA
============================ */

let fotoPerfilAtual = prof.photoUrl;

/* FOTO DE PERFIL */

if (req.body.fotoPerfil !== undefined) {
  updateData.photoUrl = req.body.fotoPerfil;
  fotoPerfilAtual = req.body.fotoPerfil;
}

/* Compatibilidade com frontend usando photoUrl */

if (req.body.photoUrl !== undefined) {
  updateData.photoUrl = req.body.photoUrl;
  fotoPerfilAtual = req.body.photoUrl;
}

/* CAPA DO PERFIL */

if (req.body.banner !== undefined) {
  updateData.banner = req.body.banner;
}

/* Compatibilidade com frontend usando bannerUrl */

if (req.body.bannerUrl !== undefined) {
  updateData.banner = req.body.bannerUrl;
}

    /* ============================
       GALERIA
    ============================ */

    if (Array.isArray(req.body.galeria)) {
      let galeria = req.body.galeria.filter(Boolean);

      if (fotoPerfilAtual) {
        galeria = galeria.filter((img) => img !== fotoPerfilAtual);
      }

      galeria = [...new Set(galeria)];

      if (galeria.length > 6) {
        return res.status(400).json({
          ok: false,
          message: 'Limite máximo de 6 fotos.',
        });
      }

      updateData.galeria = galeria;
    }
/* ============================
   SERVIÇOS
============================ */

if (Array.isArray(req.body.servicos)) {
  updateData.servicos = req.body.servicos.map(s => ({
    nome: s.nome,
    valor: s.valor
  }));
}
/* ============================
   VALIDAÇÃO SOCORRISTA
============================ */

const socorristaFinal =
  updateData.socorristaAutomotivo !== undefined
    ? updateData.socorristaAutomotivo
    : prof.socorristaAutomotivo;

const servicosSocorroFinal =
  updateData.servicosSocorroAutomotivo !== undefined
    ? updateData.servicosSocorroAutomotivo
    : prof.servicosSocorroAutomotivo || [];

if (!socorristaFinal) {
  updateData.servicosSocorroAutomotivo = [];
}

if (socorristaFinal && servicosSocorroFinal.length === 0) {
  return res.status(400).json({
    ok: false,
    message: 'Selecione pelo menos um serviço de socorro automotivo.',
  });
}
    /* ============================
       UPDATE FINAL
    ============================ */

    const updated = await Profissional.findOneAndUpdate(
  { _id: prof._id },
  { $set: updateData },
  { new: true, runValidators: true }
);

console.log('SALVO NO BANCO:', updated);
await activityEngine.register(
    updated._id,
    activityEngine.EVENTS.PROFILE_UPDATED
);
// Atualiza automaticamente o TanaScore


return res.json({
  ok: true,
  message: 'Perfil atualizado com sucesso',
  profissional: updated,
});

  } catch (error) {
    console.error('profissionais.updateMe:', error);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao atualizar perfil',
      details: error.message,
    });
  }
};

/* ============================================================================ 
 * UPDATE BANK
 * ========================================================================== */

exports.updateBank = async (req, res) => {
  try {
    const id = getUserId(req);

    if (!id)
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado',
      });

    const prof = await Profissional.findOneAndUpdate(
      { userId: id },
      { $set: { bank: req.body } },
      { new: true, runValidators: true }
    );

    if (!prof)
      return res.status(404).json({
        ok: false,
        message: 'Profissional não encontrado',
      });

    return res.json({ ok: true, data: prof.bank });

  } catch (e) {
    console.error('profissionais.updateBank:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao salvar conta bancária',
    });
  }
};
exports.getMe = async (req, res) => {
  try {
    const id = getUserId(req);

    if (!id)
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado',
      });

    const prof = await Profissional.findOne({ userId: id }).lean();

    if (!prof)
      return res.status(404).json({
        ok: false,
        message: 'Profissional não encontrado',
      });
prof.servicosSocorroAutomotivo = Array.isArray(prof.servicosSocorroAutomotivo)
  ? prof.servicosSocorroAutomotivo
  : [];
    return res.json({ ok: true, data: prof });

  } catch (e) {
    console.error('profissionais.getMe:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar perfil',
    });
  }
};
const bcrypt = require('bcryptjs');

exports.alterarSenha = async (req, res) => {
  try {
    const id = getUserId(req);

    if (!id) {
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado'
      });
    }

    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({
        ok: false,
        message: 'Dados obrigatórios'
      });
    }

    const user = await User.findById(id).select('+password');

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado'
      });
    }

    const senhaValida = await bcrypt.compare(
      senhaAtual,
      user.password
    );

    if (!senhaValida) {
      return res.status(400).json({
        ok: false,
        message: 'Senha atual incorreta'
      });
    }

    const hash = await bcrypt.hash(novaSenha, 10);

    user.password = hash;
    await user.save();

    return res.json({
      ok: true,
      message: 'Senha alterada com sucesso'
    });

  } catch (e) {
    console.error('alterarSenha:', e);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao alterar senha'
    });
  }
};
/* ============================================================================ 
 * STATUS OPERACIONAL
 * ========================================================================== */

exports.updateStatus = async (req, res) => {
  try {
    const id = getUserId(req);
    const { operationalStatus, online } = req.body;

    if (!id)
      return res.status(401).json({
        ok: false,
        message: 'Não autenticado',
      });

    if (
      operationalStatus &&
      !['disponivel', 'em_atendimento', 'indisponivel'].includes(
        operationalStatus
      )
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Status inválido',
      });
    }

    const prof = await Profissional.findOneAndUpdate(
      { userId: id },
      { operationalStatus, online },
      { new: true, runValidators: true }
    );

    if (!prof)
      return res.status(404).json({
        ok: false,
        message: 'Profissional não encontrado',
      });

    return res.json({
      ok: true,
      status: prof.operationalStatus,
      online: !!prof.online,
    });

  } catch (e) {
    console.error('profissionais.updateStatus:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao atualizar status',
    });
  }
  
};