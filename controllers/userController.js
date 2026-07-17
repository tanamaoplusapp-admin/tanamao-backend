const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Profissional = require('../models/Profissional');
const generateToken = require('../utils/generateToken');
const { sendMail } = require('../services/mailer');
const config = require('../config/env');
async function enviarEmailBoasVindasProfissional(user) {
  try {
    if (!user?.email) {
      console.warn('⚠️ Boas-vindas não enviado: usuário sem e-mail');
      return;
    }

    const nome =
      user.name ||
      user.nome ||
      'Profissional';

    const primeiroNome =
      nome.trim().split(' ')[0];

    const codigoIndicacao =
      user.codigoIndicacao ||
      'Consulte no app';

    const appStoreUrl =
      'https://apps.apple.com/br/app/tanam%C3%A3o/id6762280487';

    const playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.tanamao.tanamaoplus';

    const siteUrl =
      'https://tanamaoplus.com';

    await sendMail({
      to: user.email,

      subject:
        'Bem-vindo ao Tanamão+! Seu próximo passo profissional começa aqui 🚀',

      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>

          <body style="
            margin:0;
            padding:0;
            background:#F5F7F5;
            font-family:Arial, Helvetica, sans-serif;
            color:#243124;
          ">

            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="background:#F5F7F5;padding:24px 12px;"
            >
              <tr>
                <td align="center">

                  <table
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                      max-width:620px;
                      background:#FFFFFF;
                      border-radius:20px;
                      overflow:hidden;
                    "
                  >

                    <!-- HEADER -->
                    <tr>
                      <td
                        align="center"
                        style="
                          background:#2E4F2F;
                          padding:36px 28px;
                        "
                      >

                        <div style="
                          font-size:30px;
                          font-weight:800;
                          color:#FFFFFF;
                          margin-bottom:8px;
                        ">
                          Tanamão<span style="color:#FF9900;">+</span>
                        </div>

                        <div style="
                          font-size:16px;
                          color:#FFFFFF;
                          line-height:1.5;
                        ">
                          Seu trabalho. Sua evolução. Na sua mão.
                        </div>

                      </td>
                    </tr>


                    <!-- BOAS-VINDAS -->
                    <tr>
                      <td style="padding:32px 32px 16px;">

                        <h1 style="
                          margin:0 0 16px;
                          color:#2E4F2F;
                          font-size:26px;
                          line-height:1.3;
                        ">
                          Bem-vindo ao Tanamão+, ${primeiroNome}! 👋
                        </h1>

                        <p style="
                          font-size:16px;
                          line-height:1.7;
                          margin:0 0 16px;
                        ">
                          Que bom ter você com a gente!
                        </p>

                        <p style="
                          font-size:16px;
                          line-height:1.7;
                          margin:0;
                        ">
                          Esperamos que você esteja empolgado com essa nova fase
                          da sua vida profissional. O Tanamão+ foi criado para ser
                          muito mais do que um lugar onde clientes encontram
                          profissionais.
                        </p>

                        <p style="
                          font-size:16px;
                          line-height:1.7;
                        ">
                          Queremos ajudar você a
                          <strong>organizar seu trabalho, conquistar novos clientes
                          e crescer profissionalmente</strong> — seja usando o
                          Tanamão+ como parte da sua atividade principal ou como
                          uma oportunidade de gerar renda extra.
                        </p>

                      </td>
                    </tr>


                    <!-- PERFIL -->
                    <tr>
                      <td style="padding:8px 32px;">

                        <div style="
                          background:#F7F9F7;
                          border-radius:16px;
                          padding:22px;
                        ">

                          <h2 style="
                            margin:0 0 10px;
                            color:#2E4F2F;
                            font-size:19px;
                          ">
                            🚀 Comece deixando seu perfil completo
                          </h2>

                          <p style="
                            margin:0;
                            font-size:15px;
                            line-height:1.7;
                          ">
                            Você pode cadastrar
                            <strong>até 3 profissões</strong>, adicionar seus
                            serviços, especialidades e fotos dos seus trabalhos.
                            Um perfil completo ajuda os clientes a conhecerem
                            melhor você e o seu trabalho.
                          </p>

                        </div>

                      </td>
                    </tr>


                    <!-- AGENDA -->
                    <tr>
                      <td style="padding:8px 32px;">

                        <div style="
                          background:#F7F9F7;
                          border-radius:16px;
                          padding:22px;
                        ">

                          <h2 style="
                            margin:0 0 10px;
                            color:#2E4F2F;
                            font-size:19px;
                          ">
                            📅 Organize sua rotina com a Agenda
                          </h2>

                          <p style="
                            margin:0;
                            font-size:15px;
                            line-height:1.7;
                          ">
                            Organize seus atendimentos e compromissos em um só
                            lugar. Cadastre seus clientes e utilize a
                            <strong>confirmação de agendamento integrada ao
                            WhatsApp</strong>, facilitando sua comunicação e
                            deixando sua rotina mais organizada.
                          </p>

                        </div>

                      </td>
                    </tr>


                    <!-- SOCORRO AUTOMOTIVO -->
                    <tr>
                      <td style="padding:8px 32px;">

                        <div style="
                          background:#F7F9F7;
                          border-radius:16px;
                          padding:22px;
                        ">

                          <h2 style="
                            margin:0 0 10px;
                            color:#2E4F2F;
                            font-size:19px;
                          ">
                            🚗 Uma oportunidade para mecânicos e borracheiros
                          </h2>

                          <p style="
                            margin:0;
                            font-size:15px;
                            line-height:1.7;
                          ">
                            Se você trabalha como
                            <strong>mecânico ou borracheiro</strong>, também pode
                            atuar através do recurso de
                            <strong>Socorro Automotivo</strong> do Tanamão+.
                            Assim, além dos seus serviços tradicionais, você pode
                            encontrar novas oportunidades atendendo motoristas
                            que precisam de ajuda.
                          </p>

                        </div>

                      </td>
                    </tr>


                    <!-- INDIQUE E GANHE -->
                    <tr>
                      <td style="padding:8px 32px;">

                        <div style="
                          background:#FFF6E8;
                          border:2px solid #FF9900;
                          border-radius:16px;
                          padding:24px;
                        ">

                          <h2 style="
                            margin:0 0 10px;
                            color:#2E4F2F;
                            font-size:20px;
                          ">
                            🎁 Indique e Ganhe
                          </h2>

                          <p style="
                            font-size:15px;
                            line-height:1.7;
                          ">
                            Convide outros profissionais para fazerem parte do
                            Tanamão+. Quando um novo prestador se cadastrar
                            utilizando o seu código de indicação e a indicação
                            for validada, você ganha
                            <strong>+3 dias de visibilidade grátis</strong>.
                          </p>

                          <p style="
                            font-size:15px;
                            line-height:1.7;
                          ">
                            Indicou 1 profissional?
                            <strong>+3 dias.</strong><br>

                            Indicou 2 profissionais?
                            <strong>+6 dias.</strong><br>

                            E assim por diante.
                          </p>

                          <div style="
                            margin-top:20px;
                            background:#FFFFFF;
                            border-radius:12px;
                            padding:18px;
                            text-align:center;
                          ">

                            <div style="
                              font-size:13px;
                              color:#667066;
                              margin-bottom:7px;
                            ">
                              SEU CÓDIGO DE INDICAÇÃO
                            </div>

                            <div style="
                              color:#2E4F2F;
                              font-size:24px;
                              font-weight:800;
                              letter-spacing:2px;
                            ">
                              ${codigoIndicacao}
                            </div>

                          </div>

                          <p style="
                            margin:16px 0 0;
                            font-size:13px;
                            line-height:1.6;
                            color:#5D665D;
                          ">
                            Você também encontra seu código e acompanha suas
                            indicações na área <strong>Indique e Ganhe</strong>
                            do aplicativo.
                          </p>

                        </div>

                      </td>
                    </tr>


                    <!-- COMPARTILHAR PERFIL -->
                    <tr>
                      <td style="padding:8px 32px;">

                        <div style="
                          background:#F7F9F7;
                          border-radius:16px;
                          padding:22px;
                        ">

                          <h2 style="
                            margin:0 0 10px;
                            color:#2E4F2F;
                            font-size:19px;
                          ">
                            📲 Compartilhe seu perfil profissional
                          </h2>

                          <p style="
                            margin:0;
                            font-size:15px;
                            line-height:1.7;
                          ">
                            Compartilhe seu perfil do Tanamão+ com clientes pelo
                            WhatsApp, redes sociais e onde mais quiser. Assim,
                            outras pessoas podem conhecer seus serviços e seu
                            trabalho.
                          </p>

                        </div>

                      </td>
                    </tr>


                    <!-- FINAL -->
                    <tr>
                      <td
                        align="center"
                        style="padding:30px 32px 10px;"
                      >

                        <h2 style="
                          color:#2E4F2F;
                          font-size:22px;
                          margin:0 0 12px;
                        ">
                          🌱 O seu crescimento começa agora
                        </h2>

                        <p style="
                          font-size:15px;
                          line-height:1.7;
                          margin:0 0 24px;
                        ">
                          Explore o aplicativo, complete seu perfil, organize sua
                          rotina e aproveite as ferramentas disponíveis para
                          fortalecer sua vida profissional.
                        </p>

                        <a
                          href="${siteUrl}"
                          style="
                            display:inline-block;
                            background:#FF9900;
                            color:#FFFFFF;
                            text-decoration:none;
                            font-size:16px;
                            font-weight:bold;
                            padding:15px 32px;
                            border-radius:12px;
                          "
                        >
                          Conhecer o Tanamão+
                        </a>

                      </td>
                    </tr>


                    <!-- LOJAS -->
                    <tr>
                      <td
                        align="center"
                        style="padding:24px 32px;"
                      >

                        <p style="
                          font-size:13px;
                          color:#667066;
                          margin-bottom:12px;
                        ">
                          Baixe ou compartilhe o Tanamão+
                        </p>

                        <a
                          href="${appStoreUrl}"
                          style="
                            color:#2E4F2F;
                            font-weight:bold;
                            text-decoration:none;
                            margin-right:15px;
                          "
                        >
                          App Store
                        </a>

                        <a
                          href="${playStoreUrl}"
                          style="
                            color:#2E4F2F;
                            font-weight:bold;
                            text-decoration:none;
                          "
                        >
                          Google Play
                        </a>

                      </td>
                    </tr>


                    <!-- FOOTER -->
                    <tr>
                      <td
                        align="center"
                        style="
                          background:#2E4F2F;
                          padding:24px;
                        "
                      >

                        <div style="
                          color:#FFFFFF;
                          font-weight:bold;
                          font-size:16px;
                        ">
                          Equipe Tanamão+
                        </div>

                        <div style="
                          color:#DDE7DD;
                          font-size:12px;
                          margin-top:6px;
                        ">
                          Seu trabalho. Sua evolução. Na sua mão.
                        </div>

                      </td>
                    </tr>

                  </table>

                </td>
              </tr>
            </table>

          </body>
        </html>
      `,
    });

    console.log(
      `📧 E-mail de boas-vindas enviado para ${user.email}`
    );

  } catch (error) {

    /*
     * IMPORTANTE:
     * Uma falha no envio do e-mail NÃO pode
     * impedir a criação do perfil profissional.
     */
    console.error(
      '❌ Erro ao enviar e-mail de boas-vindas profissional:',
      error.message
    );

  }
}
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
  await enviarEmailBoasVindasProfissional(user);
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
  temPerfilProfissional: !!user.temPerfilProfissional,
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
    'photoUrl',
    'enderecos',
    'enderecoSelecionado',
    'cidade',
    'estado',
    'geo',
    'notificacoesAtivas'
  ];

  const patch = {};

  for (const k of allow) {
    if (req.body?.[k] !== undefined) {
      patch[k] = req.body[k];
    }
  }

  if (patch.photoUrl) {
    patch.avatar = patch.photoUrl;
    delete patch.photoUrl;
  }

  if (patch.enderecoSelecionado) {
    const e = patch.enderecoSelecionado;

    if (e.cidade) patch.cidade = e.cidade;
    if (e.estado) patch.estado = e.estado;

    if (e.latitude && e.longitude) {
      patch.geo = {
        type: 'Point',
        coordinates: [e.longitude, e.latitude],
      };
    }
  }

  const me = await User.findByIdAndUpdate(
    req.user._id,
    { $set: patch },
    { new: true, runValidators: true }
  ).select('-password');

  if (!me) {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }

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
/* =====================================================
ATIVAR PERFIL PROFISSIONAL
PARA USUÁRIO JÁ CADASTRADO
===================================================== */

exports.ativarPerfilProfissional = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(401);
    throw new Error('Usuário não autenticado');
  }

  /* =========================
     BUSCAR USUÁRIO
  ========================= */

  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }

  /* =========================
     VERIFICAR SE JÁ POSSUI
     PERFIL PROFISSIONAL
  ========================= */

  const profissionalExistente =
    await Profissional.findOne({
      userId: user._id,
    });

  if (profissionalExistente) {
    if (!user.temPerfilProfissional) {
      user.temPerfilProfissional = true;
      await user.save();
    }

    return res.json({
      ok: true,
      jaExistia: true,
      message:
        'Você já possui um perfil profissional.',
      profissional:
        profissionalExistente,
    });
  }

  /* =========================
     DADOS RECEBIDOS
  ========================= */

  const {
    cpf,
    telefone,
    cidade,
    estado,
    endereco,
  } = req.body || {};

  const cpfFinal =
    cpf ||
    user.cpf;

  const telefoneFinal =
    telefone ||
    user.phone;

  if (!cpfFinal) {
    res.status(400);
    throw new Error(
      'Informe seu CPF para ativar o perfil profissional.'
    );
  }

  if (!telefoneFinal) {
    res.status(400);
    throw new Error(
      'Informe seu telefone para ativar o perfil profissional.'
    );
  }

  /* =========================
     VERIFICAR CPF
  ========================= */

  const cpfLimpo =
    String(cpfFinal)
      .replace(/\D/g, '');

  const cpfEmUso =
    await Profissional.findOne({
      cpf: cpfLimpo,
    });

  if (
    cpfEmUso &&
    String(cpfEmUso.userId) !==
      String(user._id)
  ) {
    res.status(400);
    throw new Error(
      'Este CPF já está vinculado a outro perfil profissional.'
    );
  }

  /* =========================
     PREPARAR ENDEREÇO

     Prioridade:
     1. Endereço enviado pela tela
     2. Endereço já salvo no cliente
     3. Cidade/estado da raiz do User
  ========================= */

  const enderecoRecebido =
    endereco &&
    typeof endereco === 'object'
      ? endereco
      : {};

  const enderecoSalvo =
    user.enderecoSelecionado &&
    typeof user.enderecoSelecionado === 'object'
      ? user.enderecoSelecionado
      : {};

  const logradouro =
    enderecoRecebido.logradouro ||
    enderecoRecebido.rua ||
    enderecoSalvo.logradouro ||
    enderecoSalvo.rua ||
    '';

  const numero =
    enderecoRecebido.numero ||
    enderecoSalvo.numero ||
    '';

  const bairro =
    enderecoRecebido.bairro ||
    enderecoSalvo.bairro ||
    '';

  const cidadeFinal =
    String(
      enderecoRecebido.cidade ||
      cidade ||
      enderecoSalvo.cidade ||
      user.cidade ||
      ''
    ).trim();

  const estadoFinal =
    String(
      enderecoRecebido.estado ||
      estado ||
      enderecoSalvo.estado ||
      user.estado ||
      ''
    ).trim();

  const cep =
    enderecoRecebido.cep ||
    enderecoSalvo.cep ||
    '';

  const pais =
    enderecoRecebido.pais ||
    enderecoSalvo.pais ||
    '';

  /* =========================
     COORDENADAS
  ========================= */

  const latitudeRecebida =
    enderecoRecebido.latitude !== undefined &&
    enderecoRecebido.latitude !== null
      ? Number(enderecoRecebido.latitude)
      : null;

  const longitudeRecebida =
    enderecoRecebido.longitude !== undefined &&
    enderecoRecebido.longitude !== null
      ? Number(enderecoRecebido.longitude)
      : null;

  const latitudeSalva =
    enderecoSalvo.latitude !== undefined &&
    enderecoSalvo.latitude !== null
      ? Number(enderecoSalvo.latitude)
      : (
          Array.isArray(user.geo?.coordinates)
            ? Number(user.geo.coordinates[1])
            : null
        );

  const longitudeSalva =
    enderecoSalvo.longitude !== undefined &&
    enderecoSalvo.longitude !== null
      ? Number(enderecoSalvo.longitude)
      : (
          Array.isArray(user.geo?.coordinates)
            ? Number(user.geo.coordinates[0])
            : null
        );

  const latitude =
    Number.isFinite(latitudeRecebida)
      ? latitudeRecebida
      : latitudeSalva;

  const longitude =
    Number.isFinite(longitudeRecebida)
      ? longitudeRecebida
      : longitudeSalva;

  const temCoordenadas =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  /* =========================
     ENDEREÇO COMPLETO
  ========================= */

  const enderecoCompleto =
    enderecoRecebido.enderecoCompleto ||
    enderecoSalvo.enderecoCompleto ||
    [
      logradouro,
      numero,
      bairro,
      cidadeFinal,
      estadoFinal,
      cep,
      pais,
    ]
      .filter(Boolean)
      .join(', ');

  /* =========================
     CRIAR PERFIL PROFISSIONAL
  ========================= */

  const profissionalData = {
    userId: user._id,

    name: user.name,
    email: user.email,

    cpf: cpfLimpo,
    phone: telefoneFinal,

    endereco: {
      cep,
      logradouro,
      numero,
      bairro,
      cidade: cidadeFinal,
      estado: estadoFinal,
      pais,
      enderecoCompleto,
    },

    // Compatibilidade
    address:
      enderecoCompleto,

    statusCadastro:
      'incompleto',
  };

  /*
   * GeoJSON:
   * [longitude, latitude]
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

  const profissional =
    await Profissional.create(
      profissionalData
    );

  /* =========================
     ATIVAR TRIAL DE 45 DIAS
  ========================= */

  const agora =
    new Date();

  const expira =
    new Date(
      agora.getTime() +
      45 * 24 * 60 * 60 * 1000
    );

  user.temPerfilProfissional =
    true;

  /*
   * Mantemos role = cliente.
   * O usuário passa a possuir os
   * dois perfis.
   */

  if (
    !user.acessoExpiraEm ||
    user.acessoExpiraEm < agora
  ) {
    user.acessoExpiraEm =
      expira;

    user.planoAtivo =
      'trial_45_dias';
  }

  /* =========================
     ATUALIZAR DADOS DO USER
  ========================= */

  if (!user.cpf) {
    user.cpf =
      cpfLimpo;
  }

  if (!user.phone) {
    user.phone =
      telefoneFinal;
  }

  /*
   * Sincroniza a localização do
   * User com o endereço usado para
   * criar o perfil profissional.
   */

  user.cidade =
    cidadeFinal;

  user.estado =
    estadoFinal;

  user.enderecoSelecionado = {
    label:
      enderecoRecebido.label ||
      enderecoSalvo.label ||
      'Principal',

    // Compatibilidade
    rua:
      logradouro,

    // Novo padrão
    logradouro,

    numero,
    bairro,
    cidade:
      cidadeFinal,
    estado:
      estadoFinal,
    cep,
    pais,
    enderecoCompleto,

    latitude:
      temCoordenadas
        ? latitude
        : undefined,

    longitude:
      temCoordenadas
        ? longitude
        : undefined,
  };

  if (temCoordenadas) {
    user.geo = {
      type: 'Point',
      coordinates: [
        longitude,
        latitude,
      ],
    };
  }

  await user.save();
  await enviarEmailBoasVindasProfissional(user);
  

  /* =========================
     RESPOSTA
  ========================= */

  return res.status(201).json({
    ok: true,
    jaExistia: false,

    message:
      'Perfil profissional ativado com sucesso.',

    profissional,

    user: {
      _id:
        user._id,

      name:
        user.name,

      email:
        user.email,

      role:
        user.role,

      temPerfilProfissional:
        user.temPerfilProfissional,

      acessoExpiraEm:
        user.acessoExpiraEm,

      planoAtivo:
        user.planoAtivo,

      cidade:
        user.cidade,

      estado:
        user.estado,

      enderecoSelecionado:
        user.enderecoSelecionado,

      geo:
        user.geo,
    },
  });
});