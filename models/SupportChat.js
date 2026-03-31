const mongoose = require("mongoose");

const SupportChatSchema = new mongoose.Schema(
{
user: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true
},

role: {
type: String,
enum: [
"cliente",
"profissional",
"empresa",
"motorista",
"admin"
],
required: true
},

status: {
type: String,
enum: ["aberto", "respondido", "fechado"],
default: "aberto"
},

lastMessage: String,

lastMessageAt: Date

},
{ timestamps: true }
);

module.exports = mongoose.model("SupportChat", SupportChatSchema);