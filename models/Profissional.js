const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

const slugify = (str) =>
String(str || '')
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.toLowerCase()
.replace(/\s+/g, "-");

const profissionalSchema = new mongoose.Schema(
{
userId:{
type:mongoose.Schema.Types.ObjectId,
ref:'User',
index:true
},
categoriaId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Categoria',
  index: true
},

profissaoId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Profissao',
  index: true
},

profissaoNome: {
  type: String,
  index: true
},

tipoAtendimento: {
  domicilio: { type: Boolean, default: false },
  local: { type: Boolean, default: false },
  online: { type: Boolean, default: false }
},

/* =========================
IDENTIDADE
========================= */

name:{
type:String,
required:true,
trim:true,
index:true
},

email:{
type:String,
required:true,
lowercase:true,
trim:true,
index:true
},

password:{
type:String,
select:false,
minlength:6
},

cpf:{
type:String,
required:true,
unique:true,
index:true,
set:(v)=>{
const d=onlyDigits(v);
return d || undefined;
}
},

phone:{
type:String,
required:true,
set:(v)=>onlyDigits(v) || undefined
},

dataNascimento:{
type:String,
trim:true
},

/* =========================
PERFIL PÚBLICO
========================= */

bio:{
type:String,
trim:true,
maxlength:500
},

photoUrl:{
type:String,
trim:true
},

categoriaSlug:{
type:String,
trim:true,
index:true
},

profissoes:[
{
type:String,
trim:true
}
],
/* =========================
SERVIÇOS
========================= */

servicos: [
  {
    nome: {
      type: String,
      trim: true,
      required: true
    },
    valor: {
      type: String,
      trim: true
    }
  }
],

/* =========================
DISPONIBILIDADE
========================= */

atendeEmergencia: {
  type: Boolean,
  default: false
},

atendeFimSemana: {
  type: Boolean,
  default: false
},

atende24h: {
  type: Boolean,
  default: false
},

/* =========================
SOCORRISTA AUTOMOTIVO
========================= */

socorristaAutomotivo: {
  type: Boolean,
  default: false,
  index: true
},

atendeFimSemana: {
  type: Boolean,
  default: false
},

atende24h: {
  type: Boolean,
  default: false
},
aceitaPix: {
  type: Boolean,
  default: false
},

aceitaCartao: {
  type: Boolean,
  default: false
},

aceitaDinheiro: {
  type: Boolean,
  default: false
},

/* =========================
GALERIA
========================= */

galeria:[
{
type:String,
trim:true
}
],

/* =========================
ENDEREÇO
========================= */

endereco:{
cep:{type:String,trim:true},
logradouro:{type:String,trim:true},
numero:{type:String,trim:true},
bairro:{type:String,trim:true},

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
}
},

/* =========================
LOCALIZAÇÃO GEO
========================= */

geo:{
type:{
type:String,
enum:["Point"],
default:"Point"
},
coordinates:{
type:[Number],
index:"2dsphere"
}
},

address:{
type:String,
trim:true
},

/* =========================
STATUS OPERACIONAL
========================= */

online:{
type:Boolean,
default:false,
index:true
},

operationalStatus:{
type:String,
enum:[
'disponivel',
'em_atendimento',
'indisponivel'
],
default:'disponivel',
index:true
},

/* =========================
STATUS ADMIN
========================= */

statusCadastro:{
type:String,
enum:[
'incompleto',
'em_validacao',
'aprovado',
'reprovado'
],
default:'incompleto',
index:true
},

status:{
type:String,
enum:[
'pendente',
'aprovado',
'reprovado'
],
default:'pendente',
index:true
},

aprovado:{
type:Boolean,
default:false
},

/* =========================
MÉTRICAS
========================= */

metrics:{
totalAvaliacoes:{
type:Number,
default:0
},

mediaAvaliacoes:{
type:Number,
default:0
},

servicosFinalizados:{
type:Number,
default:0
}
}

},
{timestamps:true}
);

/* ====================
SLUG AUTOMÁTICO
==================== */

profissionalSchema.pre('save',function(next){

if(this.endereco?.cidade){

this.endereco.cidadeSlug = slugify(this.endereco.cidade);

}

next();

});

/* ====================
HASH PASSWORD
==================== */

profissionalSchema.pre('save',async function(next){

if(!this.isModified('password') || !this.password)
return next();

if(/^\$2[aby]\$/.test(this.password))
return next();

const salt = await bcrypt.genSalt(10);
this.password = await bcrypt.hash(this.password,salt);

next();

});

/* ====================
LOGIN
==================== */

profissionalSchema.methods.matchPassword = async function(candidate){

if(!this.password) return false;

return bcrypt.compare(String(candidate||''),this.password);

};

/* ====================
SERIALIZAÇÃO
==================== */

profissionalSchema.set('toJSON',{
transform(_doc,ret){

delete ret.password;
delete ret.__v;

return ret;

}
});

/* ====================
ÍNDICES IMPORTANTES
==================== */

profissionalSchema.index({
categoriaSlug:1,
"endereco.cidadeSlug":1,
online:1
});

module.exports =
mongoose.models.Profissional ||
mongoose.model('Profissional',profissionalSchema,'profissionais');