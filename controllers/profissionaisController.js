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

    const filtro = {};

    if (req.query.socorristaAutomotivo === 'true') {
      filtro.socorristaAutomotivo = true;
    } else {
      if (categoriaId) {
        if (!mongoose.Types.ObjectId.isValid(categoriaId)) {
          return res.status(400).json({
            ok: false,
            message: 'categoriaId inválido',
          });
        }
        filtro.categoriaId = new mongoose.Types.ObjectId(categoriaId);
      }

      if (profissaoId) {
        if (!mongoose.Types.ObjectId.isValid(profissaoId)) {
          return res.status(400).json({
            ok: false,
            message: 'profissaoId inválido',
          });
        }
        filtro.profissaoId = new mongoose.Types.ObjectId(profissaoId);
      }
    }

    if (cidade) {
      filtro['endereco.cidadeSlug'] = cidade.toLowerCase();
    }

    if (tipoAtendimento) {
      filtro[`tipoAtendimento.${tipoAtendimento}`] = true;
    }

    const profs = await Profissional.find(filtro)
      .populate({
        path: 'userId',
        select: 'acessoExpiraEm online'
      })
      .lean();

    const agora = new Date();

    const filtrados = profs.filter((p) => {
      const user = p.userId;

      if (!user) return false;
      if (!user.acessoExpiraEm) return false;
      if (user.acessoExpiraEm < agora) return false;

      return true;
    });

    return res.json({ ok: true, data: filtrados });

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