// controllers/apoioController.js
const OngApoio = require('../models/OngApoio');
let EmergencyContact;
try {
  EmergencyContact = require('../models/EmergencyContact');
} catch (e) {
  EmergencyContact = null;
}

function normCat(c) {
  return (c || '').toLowerCase();
}

exports.listOngs = async (req, res, next) => {
  try {
    const { categoria, q } = req.query;
    const filter = { ativo: true };

    if (categoria) {
      // categorias guardadas como array de strings minúsculas
      filter.categorias = { $in: [normCat(categoria)] };
    }

    if (q) {
      // busca textual básica nos campos nome/descricao
      filter.$or = [
        { nome: { $regex: q, $options: 'i' } },
        { descricao: { $regex: q, $options: 'i' } },
        { categorias: { $regex: q, $options: 'i' } },
      ];
    }

    const ongs = await OngApoio.find(filter).sort({ createdAt: -1 }).lean();
    res.json(ongs);
  } catch (e) {
    next(e);
  }
};

exports.createOng = async (req, res, next) => {
  try {
    const body = req.body;
    const tipos = ['email', 'cpf', 'cnpj', 'telefone', 'aleatoria'];
    if (!body.pix || !tipos.includes(body.pix.tipo)) {
      return res.status(400).json({ error: 'pix.tipo inválido' });
    }
    const created = await OngApoio.create(body);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

exports.updateOng = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await OngApoio.findByIdAndUpdate(id, req.body, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'ONG não encontrada' });
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

exports.deleteOng = async (req, res, next) => {
  try {
    const { id } = req.params;
    await OngApoio.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

const NACIONAIS = [
  { id: '180', nome: 'Central de Atendimento à Mulher (Ligue 180)', tipo: 'violencia-contra-mulher', telefone: '180', descricao: '24h, Brasil' },
  { id: '100', nome: 'Disque Direitos Humanos (Disque 100)', tipo: 'abuso-criancas-violacoes-dh', telefone: '100', descricao: '24h, Brasil' },
  { id: '188', nome: 'CVV – Apoio emocional e prevenção do suicídio', tipo: 'crise-emocional', telefone: '188', descricao: '24h, Brasil' },
  { id: '192', nome: 'SAMU – Emergência médica', tipo: 'urgencia-medica', telefone: '192', descricao: 'Emergência' },
  { id: '190', nome: 'Polícia Militar', tipo: 'violencia-domestica', telefone: '190', descricao: 'Emergência imediata' },
];

exports.listContatos = async (req, res) => {
  const { uf, cidade } = req.query;

  // Sempre devolvemos os nacionais
  const base = [...NACIONAIS];

  // Se não houver modelo/tabela, retornamos só os nacionais
  if (!EmergencyContact) {
    return res.json(base);
  }

  try {
    // Evita consultas geoespaciais (que deram erro antes). Vamos por texto/UF.
    const filter = { ativo: true };
    if (uf) filter.uf = String(uf).toUpperCase();

    if (cidade) {
      const rx = new RegExp(String(cidade).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ cidade: rx }, { nome: rx }, { descricao: rx }];
    }

    const locais = await EmergencyContact.find(filter).sort({ origem: 1, nome: 1 }).lean();

    // locais primeiro, nacionais depois
    return res.json([...(locais || []), ...base]);
  } catch (e) {
    console.error('[apoioController] listContatos erro:', e);
    // Nunca 500 pro cliente: retorna ao menos nacionais
    return res.json(base);
  }
};
