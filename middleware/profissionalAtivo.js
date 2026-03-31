const User = require('../models/user')

module.exports = async function profissionalAtivo(req,res,next){
try{

const userId = req.user?.id || req.user?._id

if(!userId) return next()

const user = await User.findById(userId)

if(!user) return next()

const temCredito = user.credito > 0
const temMensalidade = user.mensalidadeAtiva === true

if(!temCredito && !temMensalidade){
return res.status(403).json({
erro:true,
codigo:'PROFISSIONAL_INATIVO',
message:'Profissional sem crédito ou mensalidade'
})
}

next()

}catch(err){
console.log('erro middleware profissionalAtivo',err)
next()
}
}