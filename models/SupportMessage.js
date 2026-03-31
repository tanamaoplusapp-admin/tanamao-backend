const mongoose = require("mongoose");

const SupportMessageSchema = new mongoose.Schema(
{
chat: {
type: mongoose.Schema.Types.ObjectId,
ref: "SupportChat",
required: true
},

sender: {
type: String,
enum: ["user", "admin"],
required: true
},

text: {
type: String,
required: true
}

},
{ timestamps: true }
);

module.exports = mongoose.model("SupportMessage", SupportMessageSchema);