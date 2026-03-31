// controllers/driverBankController.js
const mongoose = require('mongoose');

let Driver = null;
try { Driver = require('../models/driver'); } catch (_) {
  try { Driver = require('../models/Motorista'); } catch (_) { Driver = null; }
}
let User;
try { User = require('../models/user'); } catch (_) { User = null; }

// Helpers
const ONLY_DIGITS = (v) => String(v || '').replace(/\D+/g, '');
const isCPF = (v) => ONLY_DIGITS(v).length === 11;
const asString = (v) => (v === undefined || v === null ? '' : String(v));

function sanitizeBank(data = {}) {
  return {
    metodoRecebimento: data.metodoRecebimento || null,
    pixKey: data.pixKey || data.pix || null,
    banco: data.banco || null,
    agencia: data.agencia || null,
    conta: data.conta || null,
    tipoConta: data.tipoConta || null,
    titular: data.titular || null,
    documentoTitular: data.documentoTitular || null,
    updatedAt: data.updatedAt || null,
  };
}

function maskCard(data = {}) {
  if (!data || (!data.last4 && !data.cardLast4)) return null;
  return {
    brand: data.brand || null,
    last4: data.last4 || data.cardLast4 || null,
    holderName: data.holderName || null,
    mpCustomerId: data.mpCustomerId || null,
    mpCardId: data.mpCardId || null,
    updatedAt: data.updatedAt || null,
  };
}

async function findDriverById(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;

  if (Driver) {
    const d = await Driver.findById(id);
    if (d) return d;
  }
  if (User) {
    const u = await User.findById(id);
    if (u && (u.role === 'motorista' || u.tipo === 'motorista')) return u;
  }
  return null;
}

function canEdit(reqUser, targetId) {
  if (!reqUser) return false;
  const isAdmin = reqUser.role === 'admin' || reqUser.tipo === 'admin';
  const isSelf = String(reqUser._id || reqUser.id) === String(targetId);
  return isAdmin || isSelf;
}

// GET
const getDadosBancarios = async (req, res) => {
  try {
    const id = req.params.id === 'me' ? (req.user?.id || req.user?._id) : req.params.id;
    const driver = await findDriverById(id);

    if (!driver) return res.status(404).json({ message: 'Motorista não encontrado' });
    if (!canEdit(req.user, id)) return res.status(403).json({ message: 'Sem permissão' });

    const payload = sanitizeBank(driver.dadosBancarios || {});
    return res.json(payload);
  } catch (error) {
    console.error('getDadosBancarios erro:', error);
    return res.status(500).json({ message: 'Erro ao obter dados bancários' });
  }
};

// PUT
const atualizarDadosBancarios = async (req, res) => {
  try {
    const id = req.params.id === 'me' ? (req.user?.id || req.user?._id) : req.params.id;
    const driver = await findDriverById(id);

    if (!driver) return res.status(404).json({ message: 'Motorista não encontrado' });
    if (!canEdit(req.user, id)) return res.status(403).json({ message: 'Sem permissão' });

    const {
      metodoRecebimento,
      pixKey,
      banco,
      agencia,
      conta,
      tipoConta,
      titular,
      documentoTitular,
    } = req.body || {};

    if (!metodoRecebimento || !['pix', 'banco'].includes(metodoRecebimento)) {
      return res.status(400).json({ message: "Informe metodoRecebimento = 'pix' ou 'banco'." });
    }

    if (metodoRecebimento === 'pix') {
      if (!asString(pixKey)) return res.status(400).json({ message: 'pixKey é obrigatória para receber por PIX.' });
    } else {
      if (!asString(banco) || !asString(agencia) || !asString(conta) || !asString(tipoConta)) {
        return res.status(400).json({ message: 'banco, agencia, conta e tipoConta são obrigatórios.' });
      }
    }

    if (documentoTitular && !isCPF(documentoTitular)) {
      return res.status(400).json({ message: 'documentoTitular inválido (CPF com 11 dígitos).' });
    }

    driver.dadosBancarios = {
      metodoRecebimento,
      pixKey: pixKey || undefined,
      banco: banco || undefined,
      agencia: agencia || undefined,
      conta: conta || undefined,
      tipoConta: tipoConta || undefined,
      titular: titular || driver.nome || driver.name || undefined,
      documentoTitular: documentoTitular ? ONLY_DIGITS(documentoTitular) : undefined,
      updatedAt: new Date(),
    };

    await driver.save();

    return res.status(200).json({
      message: 'Dados bancários atualizados com sucesso',
      dadosBancarios: sanitizeBank(driver.dadosBancarios),
    });
  } catch (error) {
    console.error('atualizarDadosBancarios erro:', error);
    return res.status(500).json({ message: 'Erro ao atualizar dados bancários' });
  }
};

// CARTÃO
const salvarCartaoMensalidade = async (req, res) => {
  try {
    const id = req.user?.id || req.user?._id;
    const driver = await findDriverById(id);
    if (!driver) return res.status(404).json({ message: 'Motorista não encontrado' });

    const { mpCustomerId, mpCardId, brand, last4, holderName, cardAlias } = req.body || {};

    if (!last4 || !brand) {
      return res.status(400).json({ message: 'Informe pelo menos brand e last4 do cartão.' });
    }

    driver.mensalidade = driver.mensalidade || {};
    driver.mensalidade.cartao = {
      mpCustomerId: mpCustomerId || driver.mensalidade?.cartao?.mpCustomerId || null,
      mpCardId: mpCardId || driver.mensalidade?.cartao?.mpCardId || null,
      brand,
      last4,
      holderName: holderName || null,
      cardAlias: cardAlias || null,
      updatedAt: new Date(),
    };

    await driver.save();

    return res.status(200).json({
      message: 'Cartão salvo para mensalidade.',
      cartao: maskCard(driver.mensalidade.cartao),
    });
  } catch (error) {
    console.error('salvarCartaoMensalidade erro:', error);
    return res.status(500).json({ message: 'Erro ao salvar cartão' });
  }
};

const removerCartaoMensalidade = async (req, res) => {
  try {
    const id = req.user?.id || req.user?._id;
    const driver = await findDriverById(id);
    if (!driver) return res.status(404).json({ message: 'Motorista não encontrado' });

    if (driver.mensalidade) driver.mensalidade.cartao = undefined;
    await driver.save();

    return res.json({ message: 'Cartão removido.' });
  } catch (error) {
    console.error('removerCartaoMensalidade erro:', error);
    return res.status(500).json({ message: 'Erro ao remover cartão' });
  }
};

const getCartaoMensalidade = async (req, res) => {
  try {
    const id = req.user?.id || req.user?._id;
    const driver = await findDriverById(id);
    if (!driver) return res.status(404).json({ message: 'Motorista não encontrado' });

    const masked = driver.mensalidade?.cartao ? maskCard(driver.mensalidade.cartao) : null;
    return res.json(masked);
  } catch (error) {
    console.error('getCartaoMensalidade erro:', error);
    return res.status(500).json({ message: 'Erro ao obter cartão' });
  }
};

/* ✅ EXPORT EXPLÍCITO — CORREÇÃO DEFINITIVA */
module.exports = {
  getDadosBancarios,
  atualizarDadosBancarios,
  salvarCartaoMensalidade,
  removerCartaoMensalidade,
  getCartaoMensalidade,
};
