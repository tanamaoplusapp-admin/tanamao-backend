const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const generateToken = require('../utils/generateToken');
const { sendMail } = require('../services/mailer');
const config = require('../config/env');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const normalizeEmail = (email) =>
  String(email || '').trim().toLowerCase();

const MIN_PASS = 6;

/* =====================================================
JWT
===================================================== */

const signAuthToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role || 'cliente',
      porteEmpresa: user.porteEmpresa || undefined,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );


exports.registerUser = asyncHandler(async (req, res) => {

  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Todos os campos são obrigatórios');
  }

  if (String(name).trim().length < 2) {
    res.status(400);
    throw new Error('Nome muito curto.');
  }

  if (String(password).length < MIN_PASS) {
    res.status(400);
    throw new Error(`Senha deve ter pelo menos ${MIN_PASS} caracteres.`);
  }

  const normEmail = normalizeEmail(email);

  const exists = await User.findOne({ email: normEmail });

  if (exists) {
    res.status(400);
    throw new Error('E-mail já cadastrado');
  }

  const rawVerifyToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenHash = hashToken(rawVerifyToken);

  const user = await User.create({
    name: String(name).trim(),
    email: normEmail,
    password,
    verificationToken: verificationTokenHash,
    isVerified: false,
    role: role || 'cliente',
  });

  /* =========================
   TRIAL 45 DIAS PROFISSIONAL
========================= */

if (user.role === 'profissional') {

  const agora = new Date();

  const expira = new Date(
    agora.getTime() + 45 * 24 * 60 * 60 * 1000
  );

  user.perfilAtivo = true;
  user.acessoLiberado = true;
  user.planoAtivo = true;
  user.acessoExpiraEm = expira;

  user.planType = 'trial_45_dias';
  user.subscriptionStatus = 'active';

  await user.save();
}

  const verifyUrl =
    `${config.frontendUrl}/verify-email?token=${rawVerifyToken}`;

  await sendMail({
    to: normEmail,
    subject: 'Confirme seu cadastro',
    html: `
      <p>Olá, ${user.name}!</p>
      <p>Confirme seu cadastro clicando no link abaixo:</p>
      <p><a href="${verifyUrl}" target="_blank">Confirmar e-mail</a></p>
    `,
  });

  res.status(201).json({
    message:
      'Usuário criado com sucesso. Verifique seu e-mail para ativar sua conta.',
  });

});
/* =====================================================
VERIFICAR EMAIL
===================================================== */

exports.verifyEmail = asyncHandler(async (req, res) => {

  const raw = req.params.token || req.query.token;

  if (!raw) {
    res.status(400);
    throw new Error('Token ausente');
  }

  const tokenHash = hashToken(raw);

  const user = await User.findOne({
    verificationToken: tokenHash,
  });

  if (!user) {
    res.status(400);
    throw new Error('Token inválido ou expirado');
  }

  user.isVerified = true;
  user.verificationToken = undefined;

  await user.save();

  res.json({
    message:
      'E-mail verificado com sucesso. Agora você pode fazer login.',
  });

});

/* =====================================================
REENVIAR VERIFICAÇÃO
===================================================== */

exports.resendVerification = asyncHandler(async (req, res) => {

  const email = normalizeEmail(req.body?.email);

  if (!email) {
    res.status(400);
    throw new Error('E-mail é obrigatório');
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.json({
      message:
        'Se o e-mail existir, enviaremos o link novamente.',
    });
  }

  if (user.isVerified) {
    return res.json({
      message: 'Conta já verificada.',
    });
  }

  const rawVerifyToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenHash = hashToken(rawVerifyToken);

  user.verificationToken = verificationTokenHash;

  await user.save();

  const verifyUrl =
    `${config.frontendUrl}/verify-email?token=${rawVerifyToken}`;

  await sendMail({
    to: email,
    subject: 'Confirme seu cadastro',
    html: `
      <p>Olá, ${user.name}!</p>
      <p><a href="${verifyUrl}">Confirmar e-mail</a></p>
    `,
  });

  res.json({
    message:
      'Link de verificação reenviado (se o e-mail existir).',
  });

});

/* =====================================================
LOGIN
===================================================== */

exports.authUser = asyncHandler(async (req, res) => {

  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400);
    throw new Error('E-mail e senha são obrigatórios');
  }

  const normEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normEmail })
    .select('+password +role +name +email +isVerified');

  if (!user) {
    res.status(401);
    throw new Error('Credenciais inválidas');
  }

  const ok = await user.matchPassword(password);

  if (!ok) {
    res.status(401);
    throw new Error('Credenciais inválidas');
  }

  if (!user.isVerified) {
    res.status(403);
    throw new Error(
      'E-mail ainda não verificado.'
    );
  }

  const token = signAuthToken(user);

  res.json({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role || 'cliente',
  isVerified: !!user.isVerified,
  token,
});

});

/* =====================================================
PERFIL
===================================================== */

exports.getMe = asyncHandler(async (req, res) => {

  const me = await User.findById(req.user._id)
    .select('-password');

  if (!me) {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }

  res.json(me);

});
/* =====================================================
ATUALIZAR PERFIL
===================================================== */

exports.updateMe = asyncHandler(async (req, res) => {

  const allow = [
    'name',
    'phone',
    'avatar',
    'photoUrl'
  ];

  const patch = {};

  for (const k of allow) {
    if (req.body?.[k] !== undefined) {
      patch[k] = req.body[k];
    }
  }

  // manter compatibilidade
  if (patch.photoUrl) {
    patch.avatar = patch.photoUrl;
  }

  const me = await User.findByIdAndUpdate(
    req.user._id,
    { $set: patch },
    { new: true }
  ).select('-password');

  res.json(me);

});

/* =====================================================
ATUALIZAR STATUS ONLINE + PAGAMENTOS
===================================================== */

exports.updateUserAvailability = asyncHandler(async (req, res) => {

  const userId = req.user?._id;

  const {
    online,
    aceitaPix,
    aceitaCartao,
    aceitaDinheiro
  } = req.body || {};

  const update = {};

  // mantém validação atual
  if (typeof online === 'boolean') {
    update.online = online;
  }

  // novos campos (opcionais)
  if (typeof aceitaPix === 'boolean') {
    update.aceitaPix = aceitaPix;
  }

  if (typeof aceitaCartao === 'boolean') {
    update.aceitaCartao = aceitaCartao;
  }

  if (typeof aceitaDinheiro === 'boolean') {
    update.aceitaDinheiro = aceitaDinheiro;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true }
  ).select('_id online aceitaPix aceitaCartao aceitaDinheiro role');

  if (!user) {
    res.status(404);
    throw new Error('Usuário não encontrado.');
  }

  res.json({
    online: user.online,
    aceitaPix: user.aceitaPix,
    aceitaCartao: user.aceitaCartao,
    aceitaDinheiro: user.aceitaDinheiro
  });

});

/* =====================================================
SALVAR TOKEN PUSH
===================================================== */

exports.savePushToken = asyncHandler(async (req, res) => {

  const userId = req.user._id;

  const { pushToken } = req.body || {};

  if (!pushToken) {
  console.log('⚠️ pushToken não enviado');
  return res.status(200).json({ ok: true });
}

  const user = await User.findByIdAndUpdate(
    userId,
    {
      fcmToken: pushToken,
      fcmTokenUpdatedAt: new Date(),
    },
    { new: true }
  ).select('_id fcmToken');

  if (!user) {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }

  res.json({
    success: true,
    fcmToken: user.fcmToken,
  });
exports.updateUserAvailability = async (req, res) => {
  try {
    const {
      online,
      aceitaPix,
      aceitaCartao,
      aceitaDinheiro
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        online,
        aceitaPix,
        aceitaCartao,
        aceitaDinheiro
      },
      { new: true }
    );

    res.json(user);

  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar disponibilidade' });
  }
};
});
exports.deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  await User.findByIdAndDelete(userId);

  res.json({
    ok: true,
    message: "Conta excluída com sucesso"
  });
});