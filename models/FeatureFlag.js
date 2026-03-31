// backend/models/FeatureFlag.js
const mongoose = require('mongoose');

const TargetingRuleSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true }, // ex.: 'userId' | 'companyId' | 'role' | 'city'
    op:    { type: String, required: true, enum: ['eq', 'neq', 'in', 'nin', 'gt', 'lt'] },
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // string | number | array
  },
  { _id: false }
);

const FeatureFlagSchema = new mongoose.Schema(
  {
    key:       { type: String, required: true, unique: true },
    enabled:   { type: Boolean, default: false },
    variant:   { type: String, default: null },
    targeting: { type: [TargetingRuleSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeatureFlag', FeatureFlagSchema);
