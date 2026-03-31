const path = require('path');
const fs = require('fs');
const { importQueue } = require('../queues/importQueue');

exports.startCsvImport = async (req, res) => {
  try {
    const empresaId = req.body?.empresaId;
    if (!empresaId) return res.status(400).json({ error: 'empresaId obrigatório' });
    if (!req.file?.path) return res.status(400).json({ error: 'Arquivo CSV ausente' });

    const filePath = path.resolve(req.file.path);
    const job = await importQueue.add('csv', {
      empresaId, filePath, options: { batchSize: Number(process.env.IMPORT_BATCH_SIZE || 500) }
    }, /** @type {JobsOptions} */({
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 60 * 60, count: 100 },
      removeOnFail: { age: 24 * 60 * 60, count: 100 },
    }));

    return res.json({ ok: true, jobId: job.id, filePath });
  } catch (e) {
    console.error('[startCsvImport] error', e);
    return res.status(500).json({ error: 'Falha ao enfileirar importação', detail: String(e.message || e) });
  }
};

exports.getImportStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const state = await importQueue.getJob(jobId);
    if (!state) return res.status(404).json({ error: 'Job não encontrado' });

    const [jobState, progress] = await Promise.all([
      state.getState(),
      state.progress
    ]);
    const result = state.returnvalue || null;

    return res.json({ ok: true, jobId, state: jobState, progress, result });
  } catch (e) {
    console.error('[getImportStatus] error', e);
    return res.status(500).json({ error: 'Falha ao obter status', detail: String(e.message || e) });
  }
};
