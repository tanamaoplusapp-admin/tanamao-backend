// backend/controllers/profissionaisController.js

const mongoose = require('mongoose');
const Profissional = require('../models/Profissional');
const User = require('../models/user');
const Order = require('../models/order');

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
      tipoAtendimento
    } = req.query;

    const filtroProfissional = {};
    const filtroUser = {};

    if (req.query.socorristaAutomotivo === 'true') {
      filtroProfissional.socorristaAutomotivo = true;
      filtroUser.socorristaAutomotivo = true;
    } else {
      if (categoriaId) {
        filtroProfissional.categoriaId = categoriaId;
        filtroUser.categoriaId = categoriaId;
      }

      if (profissaoId) {
        filtroProfissional.profissaoId = profissaoId;
        filtroUser.profissaoId = profissaoId;
      }
    }

    if (cidade) {
      filtroProfissional['endereco.cidadeSlug'] = cidade.toLowerCase();
      filtroUser['endereco.cidadeSlug'] = cidade.toLowerCase();
    }

    if (tipoAtendimento) {
      filtroProfissional[`tipoAtendimento.${tipoAtendimento}`] = true;
      filtroUser[`tipoAtendimento.${tipoAtendimento}`] = true;
    }

    // =========================
    // 1) BUSCA EM PROFISSIONAIS
    // =========================
    const profs = await Profissional.find(filtroProfissional)
      .populate({
        path: 'userId',
        select: 'acessoExpiraEm online name email phone photoUrl'
      })
      .lean();

    const agora = new Date();

    const profsNormalizados = profs
      .filter((p) => {
        const user = p.userId;
        if (!user) return false;
        if (!user.acessoExpiraEm) return false;
        if (user.acessoExpiraEm < agora) return false;
        return true;
      })
      .map((p) => {
        const user = p.userId || {};

        return {
          ...p,
          _id: p._id,
          origemColecao: 'profissionais',
          name: p.name || user.name || 'Profissional',
          email: p.email || user.email || '',
          phone: p.phone || user.phone || '',
          photoUrl: p.photoUrl || user.photoUrl || '',
          online: user.online ?? p.online ?? false,
        };
      });

    // =========================
    // 2) BUSCA EM USERS
    // =========================
    const users = await User.find({
      ...filtroUser,
      tipo: { $in: ['profissional', 'prestador', 'prestador_servico'] }
    })
      .select(
        'name email phone photoUrl acessoExpiraEm online endereco categoriaId profissaoId profissoes profissao categoria tipoAtendimento socorristaAutomotivo metrics valorMedio precoMedio aceitaPix aceitaCartao aceitaDinheiro servicos galeria status aprovado'
      )
      .lean();

    const userIdsJaRepresentados = new Set(
      profsNormalizados.map((p) => String(p.userId?._id || p.userId || ''))
    );

    const usersNormalizados = users
      .filter((u) => {
        if (!u.acessoExpiraEm) return false;
        if (u.acessoExpiraEm < agora) return false;

        // evita duplicar user que já tem documento em profissionais
        if (userIdsJaRepresentados.has(String(u._id))) return false;

        return true;
      })
      .map((u) => ({
        _id: u._id,
        userId: u._id,
        origemColecao: 'users',
        name: u.name || 'Profissional',
        email: u.email || '',
        phone: u.phone || '',
        photoUrl: u.photoUrl || '',
        online: u.online ?? false,
        endereco: u.endereco || {},
        categoriaId: u.categoriaId || null,
        profissaoId: u.profissaoId || null,
        profissoes: Array.isArray(u.profissoes)
          ? u.profissoes
          : u.profissao
          ? [u.profissao]
          : [],
        categoria: u.categoria || null,
        metrics: u.metrics || {
          mediaAvaliacoes: 0,
          totalAvaliacoes: 0,
        },
        valorMedio: u.valorMedio || u.precoMedio || null,
        aceitaPix: u.aceitaPix ?? false,
        aceitaCartao: u.aceitaCartao ?? false,
        aceitaDinheiro: u.aceitaDinheiro ?? false,
        servicos: Array.isArray(u.servicos) ? u.servicos : [],
        galeria: Array.isArray(u.galeria) ? u.galeria : [],
        status: u.status || 'pendente',
        aprovado: u.aprovado ?? false,
      }));

    // =========================
    // 3) JUNTA TUDO
    // =========================
    const listaFinal = [...profsNormalizados, ...usersNormalizados];

    return res.json({
      ok: true,
      data: listaFinal
    });
  } catch (e) {
    console.error('profissionais.list:', e);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao listar profissionais',
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
      return res.status(400).json({ ok: false, message: 'ID inválido' });

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

    if (req.body.endereco && typeof req.body.endereco === 'object')
      updateData.endereco = req.body.endereco;

    /* ============================
       PROFISSÕES
    ============================ */

    if (Array.isArray(req.body.profissoes)) {
      updateData.profissoes = req.body.profissoes;
    } else if (Array.isArray(req.body.especialidades)) {
      updateData.profissoes = req.body.especialidades;
    } else if (req.body.profissaoNome) {
      updateData.profissoes = [req.body.profissaoNome];
    }

    if (req.body.profissaoNome !== undefined)
      updateData.profissaoNome = req.body.profissaoNome;

    if (req.body.categoriaId !== undefined)
      updateData.categoriaId = req.body.categoriaId;

    if (req.body.profissaoId !== undefined)
      updateData.profissaoId = req.body.profissaoId;

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
    if (req.body.aceitaPix !== undefined)
  updateData.aceitaPix = req.body.aceitaPix;

if (req.body.aceitaCartao !== undefined)
  updateData.aceitaCartao = req.body.aceitaCartao;

if (req.body.aceitaDinheiro !== undefined)
  updateData.aceitaDinheiro = req.body.aceitaDinheiro;
/* ============================
   SOCORRISTA AUTOMOTIVO
============================ */

if (req.body.socorristaAutomotivo !== undefined)
  updateData.socorristaAutomotivo = req.body.socorristaAutomotivo;

if (req.body.atendeFimSemana !== undefined)
  updateData.atendeFimSemana = req.body.atendeFimSemana;

if (req.body.atende24h !== undefined)
  updateData.atende24h = req.body.atende24h;
    /* ============================
       FOTO
    ============================ */

    let fotoPerfilAtual = prof.photoUrl;

    if (req.body.fotoPerfil !== undefined) {
      updateData.photoUrl = req.body.fotoPerfil;
      fotoPerfilAtual = req.body.fotoPerfil;
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
       UPDATE FINAL
    ============================ */

    const updated = await Profissional.findOneAndUpdate(
      { _id: prof._id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log('SALVO NO BANCO:', updated);

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