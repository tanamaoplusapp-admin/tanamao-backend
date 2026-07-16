const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Address = require('../models/address');

/* ===================== HELPERS ===================== */

function sign(user) {
  return jwt.sign(
    {
      sub: user._id,
      userId: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/* ===================== REGISTER COMPLETE ===================== */

exports.registerComplete = async (req, res) => {
  try {

    const {
      name,
      email,
      password,
      cpf,
      telefone,
      nascimento,
      endereco
    } = req.body;

    /* ================= VALIDATION ================= */

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Nome, email e senha são obrigatórios'
      });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const exists = await User.findOne({ email: emailNorm });

    if (exists) {
      return res.status(400).json({
        ok: false,
        message: 'E-mail já cadastrado'
      });
    }

/* ================= PREPARAR ENDEREÇO ================= */

const latitude =
  endereco?.latitude !== undefined &&
  endereco?.latitude !== null
    ? Number(endereco.latitude)
    : null;

const longitude =
  endereco?.longitude !== undefined &&
  endereco?.longitude !== null
    ? Number(endereco.longitude)
    : null;

const temCoordenadas =
  Number.isFinite(latitude) &&
  Number.isFinite(longitude);

const logradouro =
  endereco?.logradouro ||
  endereco?.rua ||
  '';

const enderecoCompleto =
  endereco?.enderecoCompleto ||
  [
    logradouro,
    endereco?.numero,
    endereco?.bairro,
    endereco?.cidade,
    endereco?.estado,
    endereco?.cep,
    endereco?.pais,
  ]
    .filter(Boolean)
    .join(', ');

/* ================= CREATE USER ================= */

const hash = await bcrypt.hash(password, 10);

const userData = {
  name,
  email: emailNorm,
  password: hash,
  role: 'cliente',

  cpf,
  phone: telefone,

  cidade: endereco?.cidade || '',
  estado: endereco?.estado || '',

  enderecoSelecionado: {
    label: endereco?.label || 'Principal',

    // compatibilidade com telas antigas
    rua: logradouro,

    // novo padrão
    logradouro,

    numero: endereco?.numero || '',
    bairro: endereco?.bairro || '',
    cidade: endereco?.cidade || '',
    estado: endereco?.estado || '',
    cep: endereco?.cep || '',
    pais: endereco?.pais || '',
    enderecoCompleto,

    latitude: temCoordenadas
      ? latitude
      : undefined,

    longitude: temCoordenadas
      ? longitude
      : undefined,
  },

  isVerified: true,
};

/*
 * GeoJSON usa:
 * [longitude, latitude]
 */
if (temCoordenadas) {
  userData.geo = {
    type: 'Point',
    coordinates: [
      longitude,
      latitude,
    ],
  };
}

const user = await User.create(userData);

/* ================= CREATE ADDRESS ================= */

if (endereco) {
  await Address.create({
    userId: user._id,

    cep: endereco.cep || '',

    // mantém o padrão atual do model Address
    rua: logradouro,

    numero: endereco.numero || '',
    complemento: endereco.complemento || '',
    bairro: endereco.bairro || '',
    cidade: endereco.cidade || '',
    estado: endereco.estado || '',

    pais: endereco.pais || '',
    enderecoCompleto,

    latitude: temCoordenadas
      ? latitude
      : undefined,

    longitude: temCoordenadas
      ? longitude
      : undefined,
  });
}
    /* ================= TOKEN ================= */

    const token = sign(user);

    return res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {

    console.error('[registerComplete]', err);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao criar conta'
    });
  }
};