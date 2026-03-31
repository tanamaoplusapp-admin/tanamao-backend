const User = require('../models/user')
const Servico = require('../models/Servico')

exports.dashboard = async (req,res)=>{

try{

/* =========================
USUÁRIOS
========================= */

const users = await User.find()

const profissionais =
users.filter(u=>u.role === 'profissional')

const inadimplentes = profissionais.filter(
u => u.comissaoPendente > 0 ||
u.subscriptionStatus === 'overdue'
)

const bloqueados = profissionais.filter(
u => u.receberServicos === false
)

/* =========================
PLANOS
========================= */

const planos = {
comissao: profissionais.filter(u=>u.planType==='comissao').length,
mensal_comissao: profissionais.filter(u=>u.planType==='mensal_comissao').length,
profissional: profissionais.filter(u=>u.planType==='profissional').length
}

/* =========================
FINANCEIRO USERS
========================= */

let comissaoPendente = 0
let comissaoPaga = 0
let mensalidades = 0
let mensalidadesAtrasadas = 0

profissionais.forEach(u=>{

comissaoPendente += u.comissaoPendente || 0
comissaoPaga += u.comissaoTotalPaga || 0

if(u.mensalidadesPagas){
u.mensalidadesPagas.forEach(m=>{
mensalidades += m.valor || 0
})
}

if(u.subscriptionStatus === 'overdue'){
mensalidadesAtrasadas++
}

})

/* =========================
SERVIÇOS
========================= */

const servicos = await Servico.find()

const aceitos = servicos.filter(s=>s.status==='aceito').length
const cancelados = servicos.filter(s=>s.status==='cancelado').length
const finalizados = servicos.filter(s=>s.status==='finalizado').length

let faturamento = 0
let comissaoGerada = 0

servicos.forEach(s=>{
faturamento += s.valorPago || 0
comissaoGerada += s.comissao || 0
})

res.json({

services:{
aceitos,
cancelados,
finalizados,
faturamento,
comissaoGerada
},

finance:{
comissaoPaga,
comissaoPendente,
mensalidades,
mensalidadesAtrasadas,
receitaTotal: comissaoPaga + mensalidades
},

users:{
total:users.length,
profissionais:profissionais.length,
inadimplentes:inadimplentes.length,
bloqueados:bloqueados.length
},

plans:planos

})

}catch(e){
res.status(500).json({erro:e.message})
}

}