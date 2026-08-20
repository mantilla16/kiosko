const jwt = require('jsonwebtoken');
const { JWT_SECRET: SECRET } = require('../config');
const prisma = require('../prisma');

module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado. Inicia sesión.' });

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Sesión expirada o inválida. Inicia sesión nuevamente.' });
  }

  try {
    // Revalidar contra la BD: el usuario pudo ser desactivado o cambiar de rol
    // después de emitirse el token, así que no se confía solo en el payload.
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Tu cuenta ya no está activa. Inicia sesión nuevamente.' });
    }
    req.user = { id: user.id, username: user.username, name: user.name, role: user.role };
    next();
  } catch (e) {
    next(e);
  }
};
