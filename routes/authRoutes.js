console.log('🔥 AUTH ROUTES REALMENTE CARREGADO 🔥');

const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const router = express.Router();

/* ===== Models ===== */

const User = require('../models/user');
const Profissional = require('../models/Profissional');

/* ===== Controller NOVO ===== */

const { registerComplete } = require('../controllers/authCompleteController');

/* ===== UserController (fallback/legado) ===== */

let userCtrl = {};
try {
  userCtrl = require('../controllers/userController');
} catch (_) {
  userCtrl = {};
}

const {
  registerUser,
  verifyEmail,
  authUser
} = userCtrl;

const {
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

/* ===== Auth Controller ===== */

let authMulti = null;
try {
  authMulti = require('../controllers/authController');
} catch (err) {
  console.warn('[authRoutes] authController não encontrado:', err.message);
  authMulti = null;
}

let authController = null;
try {
  authController = require('../controllers/authController');
} catch (_) {
  authController = null;
}

const registerGeneric = authMulti?.registerGeneric;
const registerEmpresa = authMulti?.registerEmpresa;
const loginMulti = authMulti?.login;
const meHandler = authMulti?.me || authController?.me;

/* ===== Rate Limit ===== */

const createLimiter = (maxPer15m) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxPer15m,
    standardHeaders: true,
    legacyHeaders: false,
  });

/* ===========================================================
   ===== ROTAS PÚBLICAS
=========================================================== */

if (registerGeneric) {
  router.post('/register', createLimiter(100), registerGeneric);
} else if (registerUser) {
  router.post('/register', createLimiter(100), registerUser);
}

/* ===========================================================
   ===== NOVO CADASTRO CLIENTE COMPLETO
=========================================================== */

router.post('/register-complete', createLimiter(100), registerComplete);

/* ===========================================================
   ===== REGISTER PROFISSIONAL
=========================================================== */

router.post('/register-profissional', createLimiter(100), async (req, res) => {
  try {

    const {
      nome,
      email,
      telefone,
      cpf,
      senha,
      profissoes,
      banco,
      agencia,
      conta,
      tipoConta,
      pix,
      photoUrl,
    } = req.body;

    if (!nome || !email || !cpf || !telefone || !senha) {
      return res.status(400).json({
        ok: false,
        message: 'Dados obrigatórios ausentes',
      });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ email: emailNorm });

    if (existingUser) {
      return res.status(400).json({
        ok: false,
        message: 'E-mail já cadastrado',
      });
    }

    const existingCpf = await Profissional.findOne({ cpf });

    if (existingCpf) {
      return res.status(400).json({
        ok: false,
        message: 'CPF já cadastrado',
      });
    }

    const user = await User.create({
      name: nome,
      email: emailNorm,
      password: senha,
      role: 'profissional',
      phone: telefone,
      cpf,
      avatar: photoUrl || null,
    });

    const profissional = await Profissional.create({
      userId: user._id,
      name: nome,
      email: emailNorm,
      password: user.password,
      cpf,
      phone: telefone,
      avatar: photoUrl || null,
      especialidades: profissoes || [],
      bank: banco
        ? {
            banco,
            agencia,
            conta,
            tipoConta,
            pix,
            titular: nome,
            documento: cpf,
            updatedAt: new Date(),
          }
        : undefined,
    });

    const token = jwt.sign(
      {
        sub: user._id,
        userId: user._id,
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      ok: true,
      message: 'Profissional cadastrado com sucesso',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      profissional,
    });

  } catch (error) {

    console.error('register-profissional error:', error);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao cadastrar profissional',
      details: error.message,
    });
  }
});

/* ===========================================================
   ===== OUTRAS ROTAS
=========================================================== */

if (verifyEmail) {
  router.get('/verify-email/:token', verifyEmail);
}

if (forgotPassword) {
  router.post('/forgot-password', createLimiter(60), forgotPassword);
}

if (resetPassword) {
  router.post('/reset-password/:token', createLimiter(60), resetPassword);
}

if (loginMulti) {
  router.post('/login', createLimiter(300), loginMulti);
} else if (authUser) {
  router.post('/login', createLimiter(300), authUser);
}

if (registerEmpresa) {
  router.post('/register-empresa', createLimiter(60), registerEmpresa);
}
if (authController?.loginGoogle) {
  router.post('/auth/google', authController.loginGoogle);
}
/* ===========================================================
   ===== ROTAS PROTEGIDAS
=========================================================== */

let authMiddleware;
try {
  authMiddleware = require('../middlewares/authMiddleware');
} catch (_) {
  authMiddleware = null;
}

let verifyTokenSafe = (req,res,next)=>next();

try{
const auth = require('../middleware/verifyToken')
if(typeof auth.verifyToken === 'function'){
verifyTokenSafe = auth.verifyToken
}
}catch(e){}

if (meHandler) {
  if (authMiddleware) {
    router.get('/me', authMiddleware, createLimiter(1200), meHandler);
  } else {
    router.get('/me', verifyTokenSafe, createLimiter(1200), meHandler);
  }
}
router.post('/logout', async (req, res) => {
  try {

    return res.json({
      ok: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao fazer logout'
    });
  }
});
/* ===========================================================
   ===== EXPORT
=========================================================== */

module.exports = router;