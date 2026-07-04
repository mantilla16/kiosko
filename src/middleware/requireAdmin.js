module.exports = function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Se requieren permisos de administrador.' });
  }
  next();
};
