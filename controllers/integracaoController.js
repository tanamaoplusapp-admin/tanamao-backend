// controllers/integracaoController.js
import Integracao from '../models/Integracao.js';

export async function saveErpToken(req, res) {
  const payload = req.body;
  const doc = await Integracao.findOneAndUpdate(
    { empresaId: payload.empresaId },
    { $set: payload },
    { upsert: true, new: true }
  );
  res.json({ ok: true, integracao: doc });
}

export async function getStatus(req, res) {
  const { empresaId } = req.query;
  const doc = await Integracao.findOne({ empresaId }).lean();
  res.json({
    ok: true,
    status: doc?.lastStatus || { lastSync: null, counts: {}, errors: [] },
    provider: doc?.provider,
    mode: doc?.mode
  });
}

export async function uploadCsv(req, res) {
  // Assumindo middleware de upload já existente (multer) em middleware/upload.js
  // O cron/worker vai processar; aqui só confirma o recebimento.
  res.json({ ok: true, received: true, file: req.file?.filename, empresaId: req.body?.empresaId });
}
