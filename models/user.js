const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const { Schema, Types } = mongoose;

const isBcryptHash = (s) => /^\$2[aby]\$/.test(String(s || ''));
const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

const slugify = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');

const userSchema = new Schema(
{
  /* ============================
   * IDENTIFICAÇÃO
   * ============================ */

  name:{
    type:String,
    required:[true,'Nome é obrigatório'],
    trim:true,
    minlength:2,
    index:true
  },

  email:{
    type:String,
    required:[true,'E-mail é obrigatório'],
    unique:true,
    lowercase:true,
    trim:true,
    validate:[validator.isEmail,'E-mail inválido'],
    index:true
  },

  password:{
    type:String,
    required:[true,'Senha é obrigatória'],
    minlength:6,
    select:false
  },

  /* ============================
   * PAPEL
   * ============================ */

  role:{
    type:String,
    enum:['cliente','empresa','profissional','motorista','admin'],
    default:'cliente',
    index:true
  },
/* ============================
 * PERFIS DISPONÍVEIS
 * ============================ */

/*
 * Indica se este usuário também possui
 * um perfil profissional vinculado.
 *
 * O role continua representando o tipo
 * original/principal da conta para manter
 * compatibilidade com o sistema atual.
 */

temPerfilProfissional:{
  type:Boolean,
  default:false,
  index:true
},
  /* ============================
   * CONTATO
   * ============================ */

  phone:{
    type:String,
    set:(v)=>onlyDigits(v) || undefined
  },

  cpf:{
    type:String,
    set:(v)=>onlyDigits(v) || undefined
  },

  avatar:{
    type:String,
    default:null
  },

  /* ============================
   * LOCALIZAÇÃO
   * ============================ */

  cidade:{
    type:String,
    trim:true,
    index:true
  },

  cidadeSlug:{
    type:String,
    index:true
  },

  estado:{
    type:String,
    trim:true
  },

  geo:{
    type:{
      type:String,
      enum:['Point'],
      default:'Point'
    },
    coordinates:{
      type:[Number],
      index:'2dsphere'
    }
  },
 enderecos: [
  {
    label: {
      type: String,
      trim: true,
    },

    rua: {
      type: String,
      trim: true,
    },

    logradouro: {
      type: String,
      trim: true,
    },

    numero: {
      type: String,
      trim: true,
    },

    bairro: {
      type: String,
      trim: true,
    },

    cidade: {
      type: String,
      trim: true,
    },

    estado: {
      type: String,
      trim: true,
    },

    cep: {
      type: String,
      trim: true,
    },

    pais: {
      type: String,
      trim: true,
    },

    enderecoCompleto: {
      type: String,
      trim: true,
    },

    latitude: {
      type: Number,
    },

    longitude: {
      type: Number,
    },
  }
],

enderecoSelecionado: {
  label: {
    type: String,
    trim: true,
  },

  rua: {
    type: String,
    trim: true,
  },

  logradouro: {
    type: String,
    trim: true,
  },

  numero: {
    type: String,
    trim: true,
  },

  bairro: {
    type: String,
    trim: true,
  },

  cidade: {
    type: String,
    trim: true,
  },

  estado: {
    type: String,
    trim: true,
  },

  cep: {
    type: String,
    trim: true,
  },

  pais: {
    type: String,
    trim: true,
  },

  enderecoCompleto: {
    type: String,
    trim: true,
  },

  latitude: {
    type: Number,
  },

  longitude: {
    type: Number,
  },
},

  /* ============================
   * MOTORISTA
   * ============================ */

  motoristaAprovado:{
    type:Boolean,
    default:false,
    index:true
  },

  statusCadastro:{
    type:String,
    enum:[
      'incompleto',
      'documentos_enviados',
      'pendente_aprovacao',
      'aprovado',
      'reprovado'
    ],
    default:'incompleto',
    index:true
  },

  /* ============================
   * DISPONIBILIDADE
   * ============================ */

  online:{
    type:Boolean,
    default:false,
    index:true
  },

  /* ============================
   * PUSH
   * ============================ */

  fcmToken:{
    type:String,
    default:null
  },

  fcmTokenUpdatedAt:{
    type:Date,
    default:null
  },

  pushEnabled:{
    type:Boolean,
    default:true
  },

  /* ============================
   * NOTIFICAÇÕES
   * ============================ */

  unreadNotifications:{
    type:Number,
    default:0,
    index:true
  },
  notificacoesAtivas: {
  type: Boolean,
  default: true,
},

  /* ============================
   * FINANCEIRO NOVO
   * ============================ */

  receberServicos:{
    type:Boolean,
    default:true,
    index:true
  },

  
/* ============================
 * ACESSO POR DIAS (NOVO)
 * ============================ */

acessoExpiraEm:{
  type:Date,
  default:null,
  index:true
},

planoAtivo:{
  type:String,
  enum:[
  'trial_45_dias',
  '1_dia',
  '7_dias',
  '15_dias',
  '30_dias'
],
  default:null
},
/* ============================
 * SISTEMA DE INDICAÇÃO
 * ============================ */

/*
 * Código único que este profissional
 * poderá compartilhar com outros
 * prestadores.
 *
 * Exemplo: MARCE8F3A
 */
codigoIndicacao: {
  type: String,
  unique: true,
  sparse: true,
  uppercase: true,
  trim: true,
  index: true,
  default: null,
},

/*
 * Usuário profissional responsável
 * pela indicação deste novo prestador.
 */
indicadoPor: {
  type: Types.ObjectId,
  ref: 'User',
  default: null,
  index: true,
},

/*
 * Garante que este cadastro só possa
 * gerar um bônus de indicação.
 */
bonusIndicacaoConcedido: {
  type: Boolean,
  default: false,
},

/*
 * Quantidade total de indicações
 * válidas feitas por este profissional.
 */
totalIndicacoes: {
  type: Number,
  default: 0,
},
  /* ============================
   * ADMIN
   * ============================ */

  aprovadoEm:{
    type:Date,
    default:null
  },

  aprovadoPor:{
    type:Types.ObjectId,
    ref:'User',
    default:null
  },

  observacaoAdmin:{
    type:String,
    trim:true,
    default:null
  },

  /* ============================
   * SEGURANÇA
   * ============================ */

  isVerified:{
    type:Boolean,
    default:false
  },

  verificationToken:String,

  passwordResetToken:String,

  passwordResetExpires:Date,

  loginAttempts:{
    type:Number,
    default:0
  },

  lockUntil:{
    type:Date
  },

  /* ============================
   * MÉTRICAS
   * ============================ */

  lucroAcumulado:{
    type:Number,
    default:0
  },

  lastLoginAt:{
    type:Date
  }

},
{ timestamps:true }
);

/* ============================
VIRTUAL COMPATIBILIDADE
============================ */

userSchema
.virtual('tipo')
.get(function(){
  return this.role;
})
.set(function(v){
  this.role = v;
});

userSchema.index({ role:1, createdAt:-1 });

/* ============================
SLUG CIDADE
============================ */

userSchema.pre('save',function(next){

if(this.cidade){
this.cidadeSlug = slugify(this.cidade);
}

next();

});

/* ============================
HASH PASSWORD
============================ */

userSchema.pre('save',async function(next){

if(!this.isModified('password')) return next();

if(isBcryptHash(this.password)) return next();

const salt = await bcrypt.genSalt(12);

this.password = await bcrypt.hash(this.password,salt);

next();

});

/* ============================
UPDATE PASSWORD
============================ */

userSchema.pre('findOneAndUpdate',async function(next){

const update = this.getUpdate() || {};

const pwd =
update?.$set?.password ??
update?.password ??
update?.$setOnInsert?.password;

if(!pwd || isBcryptHash(pwd)) return next();

const salt = await bcrypt.genSalt(12);

const hashed = await bcrypt.hash(String(pwd),salt);

if(update.$set?.password) update.$set.password = hashed;
else if(update.password) update.password = hashed;
else if(update.$setOnInsert?.password)
update.$setOnInsert.password = hashed;

this.setUpdate(update);

next();

});

/* ============================
MÉTODOS
============================ */

userSchema.methods.matchPassword = async function(enteredPassword){

if(!enteredPassword || !this.password) return false;

return bcrypt.compare(String(enteredPassword),this.password);

};

userSchema.methods.comparePassword =
userSchema.methods.matchPassword;

/* ============================
SERIALIZAÇÃO SEGURA
============================ */

userSchema.set('toJSON',{
virtuals:true,
transform(_doc,ret){

delete ret.password;
delete ret.verificationToken;
delete ret.passwordResetToken;
delete ret.__v;

return ret;

}
});

/* ============================
EXPORT
============================ */

module.exports =
mongoose.models.User ||
mongoose.model('User',userSchema);