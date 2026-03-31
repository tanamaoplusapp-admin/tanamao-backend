// services/integracoes/companySync.js
const IntegrationAccount = require('../../models/IntegrationAccount');
let Company;
try { Company = require('../../models/company'); } catch { Company = null; }

exports.syncCompanyAllProviders = async (companyId) => {
  const company = Company ? await Company.findById(companyId).lean() : null;
  const accounts = await IntegrationAccount.find({ companyId, 'scopes.company': true, enabled: true }).lean();
  const results = [];

  for (const acc of accounts) {
    if (acc.provider === 'tiny') {
      // TODO: enviar/atualizar cadastro da empresa no Tiny (se aplicável)
      results.push({ provider: 'tiny', ok: true });
    } else if (acc.provider === 'omie') {
      // TODO: enviar/atualizar cadastro da empresa/cliente no Omie
      results.push({ provider: 'omie', ok: true });
    }
  }

  return { ok: true, results };
};
