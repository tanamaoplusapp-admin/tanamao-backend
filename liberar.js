require('dotenv').config()

const mongoose = require('mongoose')
const User = require('./models/user')

mongoose.connect(process.env.MONGO_URI).then(async()=>{

await User.updateOne(
{ email: "marcelavieeira@gmail.com" },
{
$set:{
planoAtivo: "30_dias",
acessoExpiraEm: new Date(Date.now() + 30*86400000)
}
}
)

console.log("USUÁRIO LIBERADO")

process.exit()

})