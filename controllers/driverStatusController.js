// backend/controllers/driverStatusController.js
const Presence = require('../models/Presence');


async function setPresence(actorId, role, online) {
return Presence.findOneAndUpdate(
{ actorId, role },
{ online, updatedAt: new Date() },
{ upsert: true, new: true }
);
}


exports.getMotorista = async (req, res) => {
const { id } = req.params; // motoristaId
const doc = await Presence.findOne({ actorId: id, role: 'motorista' });
res.json({ online: !!doc?.online, updatedAt: doc?.updatedAt || null });
};


exports.patchMotorista = async (req, res) => {
const { id } = req.params;
const { online } = req.body;
if (String(req.user.id) !== String(id) && !req.user.roles?.includes('admin')) {
return res.status(403).json({ error: 'forbidden' });
}
const doc = await setPresence(id, 'motorista', !!online);
res.json({ online: doc.online, updatedAt: doc.updatedAt });
};


exports.getProfissional = async (req, res) => {
const { id } = req.params; // profissionalId
const doc = await Presence.findOne({ actorId: id, role: 'profissional' });
res.json({ online: !!doc?.online, updatedAt: doc?.updatedAt || null });
};


exports.patchProfissional = async (req, res) => {
const { id } = req.params;
const { online } = req.body;
if (String(req.user.id) !== String(id) && !req.user.roles?.includes('admin')) {
return res.status(403).json({ error: 'forbidden' });
}
const doc = await setPresence(id, 'profissional', !!online);
res.json({ online: doc.online, updatedAt: doc.updatedAt });
};