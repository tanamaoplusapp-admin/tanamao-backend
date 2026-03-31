const express = require('express')
const router = express.Router()

/* ================= AUTH SAFE ================= */

let verifyToken = (req,res,next)=>next()

try{
const auth = require('../middleware/verifyToken')

if(typeof auth.verifyToken === 'function'){
verifyToken = auth.verifyToken
}

}catch(e){
console.warn('verifyToken fallback')
}

const User = require('../models/user')

/* =====================================================
RESUMO CENTRAL MENSALIDADE
===================================================== */

router.get(
'/central-mensalidade/resumo',
verifyToken,
async (req, res) => {

try {

const earlyAdopters = await User.countDocuments({
role: 'profissional',
earlyAdopter: true
})

const ativos = await User.countDocuments({
role: 'profissional',
subscriptionStatus: 'active'
})

const inadimplentes = await User.countDocuments({
role: 'profissional',
subscriptionStatus: 'overdue'
})

res.json({
earlyAdopters,
ativos,
inadimplentes
})

} catch (error) {

console.error(error)

res.status(500).json({
error: 'Erro resumo mensalidade'
})

}

}
)

module.exports = router