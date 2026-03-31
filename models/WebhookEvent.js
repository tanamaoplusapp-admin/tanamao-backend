const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
{
requestId:{
type:String,
required:true,
unique:true,
index:true
},

type:{
type:String
},

action:{
type:String
},

dataId:{
type:String
},

receivedAt:{
type:Date,
default:Date.now
}

},
{ timestamps:true }
);

module.exports = mongoose.model(
'WebhookEvent',
webhookEventSchema
);