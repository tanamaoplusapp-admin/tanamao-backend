module.exports = function requireAdmin(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Token inválido' });
    }

    if (user.role !== 'admin' && user.type !== 'admin') {
      return res.status(403).json({ message: 'Acesso restrito ao admin' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: 'Erro de autorização' });
  }
};
