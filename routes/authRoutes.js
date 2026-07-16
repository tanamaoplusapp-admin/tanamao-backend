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

      // Mantidos por compatibilidade
      cidade,
      estado,

      // Novo padrão de endereço
      endereco,

      profissoes,
      banco,
      agencia,
      conta,
      tipoConta,
      pix,
      photoUrl,
    } = req.body || {};

    /* =========================
       VALIDAÇÃO
    ========================= */

    if (!nome || !email || !cpf || !telefone || !senha) {
      return res.status(400).json({
        ok: false,
        message: 'Dados obrigatórios ausentes',
      });
    }

    const emailNorm = String(email)
      .trim()
      .toLowerCase();

    const cpfLimpo = String(cpf)
      .replace(/\D/g, '');

    /* =========================
       VERIFICAR E-MAIL
    ========================= */

    const existingUser = await User.findOne({
      email: emailNorm,
    });

    if (existingUser) {
      return res.status(400).json({
        ok: false,
        message: 'E-mail já cadastrado',
      });
    }

    /* =========================
       VERIFICAR CPF
    ========================= */

    const existingCpf = await Profissional.findOne({
      cpf: cpfLimpo,
    });

    if (existingCpf) {
      return res.status(400).json({
        ok: false,
        message: 'CPF já cadastrado',
      });
    }

    /* =========================
       PREPARAR ENDEREÇO
    ========================= */

    const enderecoRecebido =
      endereco && typeof endereco === 'object'
        ? endereco
        : {};

    const logradouro =
      enderecoRecebido.logradouro ||
      enderecoRecebido.rua ||
      '';

    const cidadeFinal =
      enderecoRecebido.cidade ||
      cidade ||
      '';

    const estadoFinal =
      enderecoRecebido.estado ||
      estado ||
      '';

    const latitude =
      enderecoRecebido.latitude !== undefined &&
      enderecoRecebido.latitude !== null
        ? Number(enderecoRecebido.latitude)
        : null;

    const longitude =
      enderecoRecebido.longitude !== undefined &&
      enderecoRecebido.longitude !== null
        ? Number(enderecoRecebido.longitude)
        : null;

    const temCoordenadas =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    const enderecoCompleto =
      enderecoRecebido.enderecoCompleto ||
      [
        logradouro,
        enderecoRecebido.numero,
        enderecoRecebido.bairro,
        cidadeFinal,
        estadoFinal,
        enderecoRecebido.cep,
        enderecoRecebido.pais,
      ]
        .filter(Boolean)
        .join(', ');

    /* =========================
       PREPARAR USER
    ========================= */

    const userData = {
      name: nome,
      email: emailNorm,
      password: senha,
      role: 'profissional',

      phone: telefone,
      cpf: cpfLimpo,

      cidade: cidadeFinal,
      estado: estadoFinal,

      enderecoSelecionado: {
        label:
          enderecoRecebido.label ||
          'Principal',

        // Compatibilidade com telas antigas
        rua: logradouro,

        // Novo padrão
        logradouro,

        numero:
          enderecoRecebido.numero ||
          '',

        bairro:
          enderecoRecebido.bairro ||
          '',

        cidade:
          cidadeFinal,

        estado:
          estadoFinal,

        cep:
          enderecoRecebido.cep ||
          '',

        pais:
          enderecoRecebido.pais ||
          '',

        enderecoCompleto,

        latitude:
          temCoordenadas
            ? latitude
            : undefined,

        longitude:
          temCoordenadas
            ? longitude
            : undefined,
      },

      avatar:
        photoUrl ||
        null,
    };

    /*
     * GeoJSON:
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

    /* =========================
       CRIAR USER
    ========================= */

    const user = await User.create(
      userData
    );

    /* =========================
       TRIAL 45 DIAS
    ========================= */

    const agora = new Date();

    const expira = new Date(
      agora.getTime() +
      45 * 24 * 60 * 60 * 1000
    );

    user.perfilAtivo = true;
    user.acessoLiberado = true;

    user.acessoExpiraEm = expira;

    user.planType =
      'trial_45_dias';

    user.subscriptionStatus =
      'active';

    await user.save();

    /* =========================
       PREPARAR PROFISSIONAL
    ========================= */

    const profissionalData = {
      userId: user._id,

      name: nome,
      email: emailNorm,

      /*
       * Mantido por compatibilidade
       * com o fluxo atual.
       */
      password: user.password,

      cpf: cpfLimpo,
      phone: telefone,

      endereco: {
        cep:
          enderecoRecebido.cep ||
          '',

        logradouro,

        numero:
          enderecoRecebido.numero ||
          '',

        bairro:
          enderecoRecebido.bairro ||
          '',

        cidade:
          cidadeFinal,

        estado:
          estadoFinal,

        pais:
          enderecoRecebido.pais ||
          '',

        enderecoCompleto,
      },

      /*
       * Mantemos address por
       * compatibilidade.
       */
      address:
        enderecoCompleto,

      photoUrl:
        photoUrl ||
        null,

      profissoes:
        Array.isArray(profissoes)
          ? profissoes
          : [],
    };

    /*
     * Salvar coordenadas também
     * no perfil profissional.
     */
    if (temCoordenadas) {
      profissionalData.geo = {
        type: 'Point',
        coordinates: [
          longitude,
          latitude,
        ],
      };
    }

    /* =========================
       DADOS BANCÁRIOS
    ========================= */

    if (banco) {
      profissionalData.bank = {
        banco,
        agencia,
        conta,
        tipoConta,
        pix,
        titular: nome,
        documento: cpfLimpo,
        updatedAt: new Date(),
      };
    }

    /* =========================
       CRIAR PROFISSIONAL
    ========================= */

    const profissional =
      await Profissional.create(
        profissionalData
      );

    /* =========================
       TOKEN
    ========================= */

    const token = jwt.sign(
      {
        sub: user._id,
        userId: user._id,
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    /* =========================
       RESPOSTA
    ========================= */

    return res.status(201).json({
      ok: true,

      message:
        'Profissional cadastrado com sucesso',

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,

        cidade: user.cidade,
        estado: user.estado,

        enderecoSelecionado:
          user.enderecoSelecionado,

        geo:
          user.geo,
      },

      profissional,
    });

  } catch (error) {
    console.error(
      'register-profissional error:',
      error
    );

    return res.status(500).json({
      ok: false,
      message:
        'Erro ao cadastrar profissional',
      details:
        error.message,
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

router.post('/login', createLimiter(300), async (req, res, next) => {
  try {
    if (authController?.login) {
      return authController.login(req, res, next);
    }

    if (loginMulti) {
      return loginMulti(req, res, next);
    }

    if (authUser) {
      return authUser(req, res, next);
    }

    return res.status(500).json({
      ok: false,
      message: 'Handler de login não encontrado',
    });
  } catch (err) {
    return next(err);
  }
});

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