const jwt = require('jsonwebtoken');
const { JWT_SECRET: SECRET } = require('../config');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado. Inicia sesión.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada o inválida. Inicia sesión nuevamente.' });
  }
};
