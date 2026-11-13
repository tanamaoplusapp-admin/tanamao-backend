'use strict';

/**
 * Cadastro completo do cliente (POST /api/auth/register-complete).
 * Compatível com CadastroClienteScreen.js e models/user.js.
 * Não modifica o cadastro de profissionais nem o fluxo de login.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const somenteDigitos = (valor) => String(valor || '').replace(/\D/g, '');
const texto = (valor) => String(valor || '').trim();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarGenero(valor) {
  const chave = texto(valor || 'nao_informado').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

  const mapa = {
    mulher_cis: 'feminino',
    homem_cis: 'masculino',
    mulher: 'feminino',
    homem: 'masculino',
    feminino: 'feminino',
    masculino: 'masculino',
    female: 'feminino',
    male: 'masculino',
    nao_binario: 'outro',
    nao_binaria: 'outro',
    outro: 'outro',
    outra: 'outro',
    nao_informado: 'nao_informado',
    prefiro_nao_informar: 'nao_informado',
  };
  return mapa[chave] ?? null;
}

function coordenadasValidas(endereco) {
  const latitude = endereco?.latitude;
  const longitude = endereco?.longitude;
  if (latitude === undefined || latitude === null || latitude === '' ||
      longitude === undefined || longitude === null || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function criarEnderecoRecebido(body) {
  const endereco = body.endereco && typeof body.endereco === 'object' &&
    !Array.isArray(body.endereco) ? body.endereco : {};

  const logradouro = texto(endereco.logradouro || endereco.rua);
  const cidade = texto(endereco.cidade || body.cidade);
  const estado = texto(endereco.estado || body.estado);
  const numero = texto(endereco.numero);
  const bairro = texto(endereco.bairro);
  const cep = texto(endereco.cep);
  const pais = texto(endereco.pais);
  const enderecoCompleto = texto(endereco.enderecoCompleto) ||
    [logradouro, numero, texto(endereco.complemento), bairro, cidade, estado, cep, pais]
      .filter(Boolean).join(', ');
  const geo = coordenadasValidas(endereco);

  const selecionado = {
    label: texto(endereco.label) || 'Principal',
    rua: logradouro,
    logradouro,
    numero,
    bairro,
    cidade,
    estado,
    cep,
    pais,
    enderecoCompleto,
  };
  if (geo) {
    selecionado.latitude = geo.lat;
    selecionado.longitude = geo.lng;
  }
  return { selecionado, cidade, estado, geo };
}

exports.registerComplete = async (req, res) => {
  try {
    const body = req.body || {};
    const name = texto(body.name || body.nome);
    const email = texto(body.email).toLowerCase();
    const password = String(body.password ?? body.senha ?? '');
    const genero = normalizarGenero(body.genero);

    if (name.length < 2) {
      return res.status(400).json({ ok: false, message: 'Informe seu nome completo.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ ok: false, message: 'Informe um e-mail válido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, message: 'A senha precisa ter pelo menos 6 caracteres.' });
    }
    if (!genero) {
      return res.status(400).json({ ok: false, message: 'Selecione uma opção de gênero válida.' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('[registerComplete] JWT_SECRET não configurado.');
      return res.status(500).json({ ok: false, message: 'Falha de configuração do servidor.' });
    }

    const jaExiste = await User.exists({ email });
    if (jaExiste) {
      return res.status(409).json({ ok: false, message: 'E-mail já cadastrado.' });
    }

    const endereco = criarEnderecoRecebido(body);
    const cadastro = {
      name,
      email,
      password, // O hash é feito pelo middleware pre('save') do modelo User.
      role: 'cliente',
      isVerified: true, // Mantém o fluxo atual: login automático após o cadastro.
      genero,
      phone: somenteDigitos(body.telefone || body.phone) || undefined,
      cpf: somenteDigitos(body.cpf) || undefined,
      cidade: endereco.cidade || undefined,
      estado: endereco.estado || undefined,
    };

    // Preserva o endereço do cadastro para a busca por profissionais na mesma cidade.
    if (endereco.cidade || endereco.estado || endereco.selecionado.logradouro) {
      cadastro.enderecoSelecionado = endereco.selecionado;
      cadastro.enderecos = [endereco.selecionado];
    }
    if (endereco.geo) {
      cadastro.geo = {
        type: 'Point',
        coordinates: [endereco.geo.lng, endereco.geo.lat],
      };
    }

    // O campo nascimento é opcional e só é persistido se constar no schema User.
    if (texto(body.nascimento)) cadastro.nascimento = texto(body.nascimento);

    const user = await User.create(cadastro);
    const userId = String(user._id);
    const token = jwt.sign({
      sub: userId,
      userId,
      id: userId,
      role: 'cliente',
      tipo: 'cliente',
      email: user.email,
    }, process.env.JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: userId,
        _id: userId,
        name: user.name,
        email: user.email,
        role: 'cliente',
        isVerified: true,
        temPerfilProfissional: false,
        genero: user.genero,
        phone: user.phone,
        cpf: user.cpf,
        cidade: user.cidade,
        estado: user.estado,
        enderecoSelecionado: user.enderecoSelecionado || null,
        geo: user.geo || null,
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ ok: false, message: 'E-mail já cadastrado.' });
    }
    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      console.error('[registerComplete] Validação:', err.message);
      return res.status(400).json({ ok: false, message: 'Dados inválidos no cadastro. Confira seus dados e tente novamente.' });
    }
    console.error('[registerComplete] Erro:', err);
    return res.status(500).json({ ok: false, message: 'Não foi possível criar sua conta. Tente novamente.' });
  }
};
