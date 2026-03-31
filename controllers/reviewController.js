// controllers/reviewController.js
const mongoose = require('mongoose');

// Tolerância a variações de case no model
let Review;
try { Review = require('../models/Review'); } catch (_) {
  try { Review = require('../models/Review'); } catch (__ ) {
    Review = require('../models/Avaliacao');
  }
}

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));
const toNum = (v) => Number(v);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/* =========================
   CREATE REVIEW
========================= */
const createReview = async (req, res) => {
  try {
    const clientId = req.user?._id || req.user?.id;
    if (!clientId) return res.status(401).json({ message: 'Não autenticado.' });

    const { professionalId, rating, comment, orderId } = req.body || {};

    if (!isId(professionalId)) {
      return res.status(400).json({ message: 'professionalId inválido.' });
    }

    let nota = toNum(rating);
    if (!Number.isFinite(nota)) {
      return res.status(400).json({ message: 'rating inválido.' });
    }
    nota = clamp(nota, 1, 5);

    const texto = (comment ?? '').toString().trim();
    if (texto.length > 1000) {
      return res.status(400).json({ message: 'Comentário muito longo (máx. 1000 caracteres).' });
    }

    const query = { clientId, professionalId };
    if (orderId && isId(orderId)) query.orderId = orderId;

    let review = await Review.findOne(query);

    if (review) {
      review.rating = nota;
      review.comment = texto || review.comment;
      await review.save();
      return res.status(200).json({ message: 'Avaliação atualizada com sucesso!', review });
    }

    review = new Review({
      clientId,
      professionalId,
      rating: nota,
      comment: texto || undefined,
      ...(orderId && isId(orderId) ? { orderId } : {}),
    });

    await review.save();
    return res.status(201).json({ message: 'Avaliação enviada com sucesso!', review });
  } catch (error) {
    console.error('[createReview]', error);
    return res.status(500).json({ message: 'Erro ao enviar avaliação', error: error.message });
  }
};

/* =========================
   GET REVIEWS
========================= */
const getReviewsByProfessional = async (req, res) => {
  try {
    const { professionalId } = req.params;
    if (!isId(professionalId)) {
      return res.status(400).json({ message: 'professionalId inválido.' });
    }

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const sort  = req.query.sort || '-createdAt';
    const skip  = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ professionalId })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('clientId', 'name nome avatar email')
        .lean(),
      Review.countDocuments({ professionalId })
    ]);

    const stats = await Review.aggregate([
      { $match: { professionalId: new mongoose.Types.ObjectId(professionalId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avg: { $avg: '$rating' },
          c1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          c2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          c3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          c4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          c5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        }
      }
    ]);

    const s = stats[0] || { total: 0, avg: null, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
    const averageRating = s.avg ? Number(s.avg.toFixed(2)) : null;
    const breakdown = { 1: s.c1, 2: s.c2, 3: s.c3, 4: s.c4, 5: s.c5 };

    return res.status(200).json({
      total,
      averageRating,
      breakdown,
      page,
      pages: Math.ceil(total / limit),
      reviews,
    });
  } catch (error) {
    console.error('[getReviewsByProfessional]', error);
    return res.status(500).json({ message: 'Erro ao buscar avaliações', error: error.message });
  }
};

/* ✅ EXPORT ÚNICO E CORRETO */
module.exports = {
  createReview,
  getReviewsByProfessional,
};
