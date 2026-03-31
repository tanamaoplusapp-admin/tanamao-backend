const { Payment, mp } = require('../services/mercadoPago')

exports.comprarCreditos = async (req,res)=>{

try{

const userId = req.user.id
const { pacote } = req.body

let valor = 0
let quantidade = 0

switch(pacote){

case 5:
valor = 25
quantidade = 5
break

case 10:
valor = 50
quantidade = 10
break

case 20:
valor = 100
quantidade = 20
break

default:
return res.status(400).json({
erro:'Pacote inválido'
})

}

const payment = await new Payment(mp).create({
body:{
transaction_amount: valor,
description: `Compra ${quantidade} créditos`,
payment_method_id:'pix',

metadata:{
type:'credits',
quantidade,
user_id:userId
}
}
})

const tx = payment.point_of_interaction.transaction_data

res.json({
qr_code: tx.qr_code,
qr_code_base64: tx.qr_code_base64
})

}catch(e){
res.status(500).json({erro:e.message})
}

}