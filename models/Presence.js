// backend/models/Presence.js
const mongoose = require('mongoose');


const PresenceSchema = new mongoose.Schema({
actorId: { type: mongoose.Schema.Types.ObjectId, required: true }, // id do motorista/profissional
role: { type: String, enum: ['motorista', 'profissional'], required: true },
online: { type: Boolean, default: false },
updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });


PresenceSchema.index({ actorId: 1, role: 1 }, { unique: true });


module.exports = mongoose.model('Presence', PresenceSchema);