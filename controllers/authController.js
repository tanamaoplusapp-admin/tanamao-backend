// =====================
// authController.js (PADRONIZADO)
// =====================


const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendMail } = require('../services/mailer');


let Company, Empresa;
try { Company = require('../models/company'); } catch (_) {}
try { Empresa = require('../models/Empresa'); } catch (_) {}
const EmpresaModel = Company || Empresa;

const User = require('../models/user');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(
process.env.GOOGLE_CLIENT_ID
);

let Profissional;
try { Profissional = require('../models/Profissional'); } catch (_) { Profissional = null; }

let validators;
try { validators = require('../utils/validators'); } catch (_) { validators = {}; }

const {
  ONLY_DIGITS = (s='') => String(s).replace(/\D+/g,''),
  validarEmail = (e='') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e)),
} = validators;


/* ===================== HELPERS ===================== */

function normRole(r) {
  if (!r) return 'cliente';
  const x = String(r).toLowerCase();
  if (['company','emp','empresa'].includes(x)) return 'empresa';
  if (['driver','motorista'].includes(x)) return 'motorista';
  if (['pro','prof','profissional'].includes(x)) return 'profissional';
  if (['admin','adm'].includes(x)) return 'admin';
  return x;
}

function deriveCompanyId(u) {
  if (!u) return null;
  return (
    u.companyId ||
    u.empresaId ||
    u.company_id ||
    u.company?._id ||
    u.empresa?._id ||
    null
  );
}

function sign(userLike, extra = {}) {

  const role = normRole(userLike.role || userLike.tipo || 'cliente');

  const payload = {
    sub: String(userLike._id),
    userId: String(userLike._id),
    role,
    tipo: role,
    email: userLike.email,
  };

  const companyId = deriveCompanyId(extra) || deriveCompanyId(userLike);

  if (companyId)
    payload.companyId = String(companyId);

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });

}

function safeUserResponse(u, options = {}) {

  const role = normRole(u?.role || u?.tipo || options.role || 'cliente');
  const companyId = options.companyId ?? deriveCompanyId(u) ?? null;

  return {
    id: u?._id || u?.id,
    name: u?.name || u?.nome,
    email: u?.email,
    role,
    companyId: companyId || null,
    isVerified: u?.isVerified,

    perfilAtivo: u?.perfilAtivo,
    acessoLiberado: u?.acessoLiberado,
    planoAtivo: u?.planoAtivo,
    acessoExpiraEm: u?.acessoExpiraEm,

    // profissão/categoria do prestador
    categoria: u?.categoria,
    profissao: u?.profissao,
    profissaoNome: u?.profissaoNome,
    categoriaProfissional: u?.categoriaProfissional,
    especialidade: u?.especialidade,
    tipoProfissional: u?.tipoProfissional,

    status: u?.status,
    plano: u?.plano,
    tipoPlano: u?.tipoPlano
  };
}


/* ===================== GET /auth/me ===================== */

exports.me = async (req, res) => {

  try {
console.log("USER ID:", req.userId)
console.log("HEADERS:", req.headers.authorization)
    if (!req.userId) {
      return res.status(401).json({
        ok:false,
        message:'Não autenticado'
      });
    }

    /* ======================
       USER
    ====================== */

    const user = await User.findById(req.userId).lean();

    if (user) {

      const role = normRole(user.role);
      const companyId = deriveCompanyId(user);

      return res.json({
        ok:true,
        user: safeUserResponse(user,{ role, companyId })
      });

    }

    /* ======================
       PROFISSIONAL
    ====================== */

    if (Profissional) {

      const prof = await Profissional.findOne({
        $or:[
          { _id:req.userId },
          { userId:req.userId }
        ]
      }).lean();

      if (prof) {
  return res.json({
    ok:true,
    user:{
      id: prof.userId || prof._id,
      name: prof.nome || prof.name,
      email: prof.email,
      role: 'profissional',
      companyId: null,
      isVerified: !!prof.isVerified,
// 🔥 ADICIONAR ISSO
      fotoPerfil: prof.photoUrl,
      photoUrl: prof.photoUrl,
      perfilAtivo: prof.perfilAtivo,
      acessoLiberado: prof.acessoLiberado,
      planoAtivo: prof.planoAtivo,
      acessoExpiraEm: prof.acessoExpiraEm,

      status: prof.status,
      plano: prof.plano
    }
  });
}

    }

    /* ======================
       EMPRESA
    ====================== */

    if (EmpresaModel) {

      const empresa = await EmpresaModel.findById(req.userId).lean();

      if (empresa) {

        return res.json({
          ok:true,
          user:{
            id: empresa._id,
            name: empresa.nome,
            email: empresa.email,
            role:'empresa',
            companyId:empresa._id,
            isVerified:!!empresa.isVerified
          }
        });

      }

    }

    return res.status(404).json({
      ok:false,
      message:'Usuário não encontrado'
    });

  }
  catch(err){

    console.error('[auth.me] erro:',err);

    return res.status(500).json({
      ok:false,
      message:'Erro interno'
    });

  }

};


/* ===================== LOGIN ===================== */

exports.login = async (req, res) => {

  try {

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        ok:false,
        message:'Email e senha são obrigatórios'
      });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: emailNorm })
      .select('+password');

    if (!user) {
      return res.status(401).json({
        ok:false,
        message:'Credenciais inválidas'
      });
    }

    const okPass = await bcrypt.compare(String(password), user.password || '');

    if (!okPass) {
      return res.status(401).json({
        ok:false,
        message:'Credenciais inválidas'
      });
    }

    const role = normRole(user.role);
    const companyId = deriveCompanyId(user);

    const token = sign(
      { _id:user._id, role, email:user.email },
      { companyId }
    );

    return res.json({
      ok:true,
      token,
      user: safeUserResponse(user,{ role, companyId })
    });

  }
  catch(err){

    console.error('[auth.login] erro:',err);

    return res.status(500).json({
      ok:false,
      message:'Erro interno'
    });

  }

};

exports.loginGoogle = async (req,res)=>{

try{

const { idToken } = req.body

if(!idToken){
return res.status(400).json({
ok:false,
message:'idToken obrigatório'
})
}

const ticket = await client.verifyIdToken({
idToken,
audience: [
process.env.GOOGLE_WEB_CLIENT_ID,
process.env.GOOGLE_ANDROID_CLIENT_ID,
process.env.GOOGLE_IOS_CLIENT_ID
]
});

const payload = ticket.getPayload()

const email = payload.email
const name = payload.name
const googleId = payload.sub

let user = await User.findOne({ email })

/* cria usuário automaticamente */

if(!user){

user = await User.create({
name,
email,
googleId,
role:'cliente',
isVerified:true
})

}

const token = sign(user)

res.json({
ok:true,
token,
user: safeUserResponse(user)
})

}catch(e){

console.log('erro google login',e)

res.status(500).json({
ok:false,
message:'erro login google'
})

}

}
exports.forgotPassword = async (req,res)=>{

try{

const { email } = req.body

if(!email){
return res.status(400).json({
message:'Email obrigatório'
})
}

const user = await User.findOne({
email: email.toLowerCase()
})

if(!user){
return res.status(404).json({
message:'Email não encontrado'
})
}

const token = jwt.sign(
{ id:user._id },
process.env.JWT_SECRET,
{ expiresIn:'1h' }
)

const link = `tanamao://reset-password/${token}`

await sendMail({
to: email,
subject: 'Redefinição de senha • Tanamão+',
html: `
<div style="background:#f5f6f8;padding:40px 20px;font-family:Arial,Helvetica,sans-serif">
  
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:30px;border:1px solid #eee">
    
    <div style="text-align:center;margin-bottom:20px">
      <h2 style="margin:0;color:#2E4F2F">Tanamão+</h2>
    </div>

    <h3 style="color:#333;margin-bottom:15px">
      Redefinir sua senha
    </h3>

    <p style="color:#555;font-size:14px;line-height:1.5">
      Recebemos uma solicitação para redefinir a senha da sua conta Tanamão+. 
      Clique no botão abaixo para criar uma nova senha.
    </p>

    <div style="text-align:center;margin:30px 0">
      <a href="${link}" 
      style="
      background:#FF9900;
      color:#ffffff;
      padding:14px 24px;
      text-decoration:none;
      border-radius:8px;
      display:inline-block;
      font-weight:bold;
      font-size:14px;
      ">
      Redefinir senha
      </a>
    </div>

    <p style="color:#777;font-size:13px;line-height:1.5">
      Este link expira em <strong>1 hora</strong> por segurança.
    </p>

    <p style="color:#777;font-size:13px;line-height:1.5">
      Se você não solicitou a redefinição de senha, ignore este email.
      Sua conta permanecerá segura.
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:25px 0"/>

    <p style="font-size:12px;color:#999;text-align:center">
      Tanamão+ • Plataforma de serviços sob demanda
    </p>

  </div>

</div>
`
})

res.json({
ok:true,
message:'Email enviado'
})

}catch(e){

console.log('forgot error',e)

res.status(500).json({
message:'erro forgot'
})

}

}

exports.resetPassword = async (req,res)=>{

try{

const { token } = req.params
const { password } = req.body

if(!password){
return res.status(400).json({
message:'Nova senha obrigatória'
})
}

const decoded = jwt.verify(
token,
process.env.JWT_SECRET
)

const user = await User.findById(decoded.id)

if(!user){
return res.status(404).json({
message:'Usuário não encontrado'
})
}

user.password = password
await user.save()

res.json({
ok:true,
message:'Senha redefinida com sucesso'
})

}catch(e){

res.status(400).json({
message:'Token inválido ou expirado'
})

}

}
/* ===================== REGISTER GENERIC ===================== */

exports.registerGeneric = async (req,res)=>{

  try{

    const {
  name,
  email,
  password,
  role = 'cliente',
  cpf,
  telefone,
  nascimento,
  cidade,
  estado
} = req.body || {};

    if (!email || !password)
      return res.status(400).json({
        ok:false,
        message:'Email e senha são obrigatórios'
      });

    if (!validarEmail(email))
      return res.status(400).json({
        ok:false,
        message:'Email inválido'
      });

    const emailNorm = String(email).trim().toLowerCase();

    if (await User.findOne({ email: emailNorm }))
      return res.status(409).json({
        ok:false,
        message:'E-mail já cadastrado'
      });

    const hash = await bcrypt.hash(String(password),10);

    const user = await User.create({
  name: name || emailNorm,
  email: emailNorm,
  password: hash,
  role: normRole(role),
  isVerified: true,

  // 🔥 NOVOS CAMPOS
  cpf,
  phone: telefone,
  cidade,
  estado,
});
    const token = sign(user);

    return res.json({
      ok:true,
      token,
      user:safeUserResponse(user)
    });

  }
  catch(err){

    console.error('[auth.registerGeneric] erro:',err);

    return res.status(500).json({
      ok:false,
      message:'Erro interno'
    });

  }

};


/* ===================== REGISTER EMPRESA ===================== */

exports.registerEmpresa = async (req,res)=>{

  try{

    if (!EmpresaModel)
      return res.status(500).json({
        ok:false,
        message:'Model de Empresa não encontrado'
      });

    const { nome,email,senha } = req.body || {};

    if (!nome || !email || !senha)
      return res.status(400).json({
        ok:false,
        message:'Dados obrigatórios ausentes'
      });

    const senhaHash = await bcrypt.hash(String(senha),10);

    const empresa = await EmpresaModel.create({
      nome,
      email,
      senha: senhaHash,
      isVerified:true
    });

    const token = sign(
      { _id:empresa._id, role:'empresa', email:empresa.email },
      { companyId:empresa._id }
    );

    return res.status(201).json({
      ok:true,
      token,
      user:safeUserResponse(empresa,{
        role:'empresa',
        companyId:empresa._id
      })
    });

  }
  catch(err){

    console.error('[auth.registerEmpresa] erro:',err);

    return res.status(500).json({
      ok:false,
      message:'Erro interno'
    });

  }

};