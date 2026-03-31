// backend/controllers/featureFlagController.js
const FeatureFlag = require('../models/FeatureFlag');


exports.list = async (req, res) => {
const flags = await FeatureFlag.find().sort({ key: 1 });
res.json(flags);
};


exports.getForUser = async (req, res) => {
const { userId, companyId, role, city } = req.query;
const all = await FeatureFlag.find({});


const matches = (flag) => {
return flag.targeting.every(rule => {
const ctx = { userId, companyId, role, city };
const left = ctx[rule.key];
const right = rule.value;
switch (rule.op) {
case 'eq': return String(left) === String(right);
case 'neq': return String(left) !== String(right);
case 'in': return Array.isArray(right) && right.map(String).includes(String(left));
case 'nin': return Array.isArray(right) && !right.map(String).includes(String(left));
case 'gt': return Number(left) > Number(right);
case 'lt': return Number(left) < Number(right);
default: return true;
}
});
};


const result = {};
for (const f of all) {
const on = f.enabled && matches(f);
result[f.key] = { enabled: !!on, variant: on ? f.variant : null };
}
res.json(result);
};


exports.create = async (req, res) => {
const created = await FeatureFlag.create(req.body);
res.status(201).json(created);
};


exports.update = async (req, res) => {
const { id } = req.params;
const updated = await FeatureFlag.findByIdAndUpdate(id, req.body, { new: true });
res.json(updated);
};


exports.remove = async (req, res) => {
const { id } = req.params;
await FeatureFlag.findByIdAndDelete(id);
res.json({ ok: true });
};