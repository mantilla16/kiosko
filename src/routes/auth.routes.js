const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const ah = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const { JWT_SECRET: SECRET, JWT_EXPIRES_IN } = require('../config');

// Limita los intentos de inicio de sesión para frenar ataques de fuerza bruta:
// máximo 10 intentos por IP cada 15 minutos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.' },
});

function makeToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Iniciar sesión
router.post('/login', loginLimiter, validate(schemas.login), ah(async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user || !user.active) throw new ApiError(401, 'Usuario o contraseña incorrectos.');
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new ApiError(401, 'Usuario o contraseña incorrectos.');
  const token = makeToken(user);
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
}));

// Obtener usuario actual
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Cambiar contraseña propia
router.post('/change-password', requireAuth, validate(schemas.changePassword), ah(async (req, res) => {
  const { current, newPass } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(current, user.password);
  if (!valid) throw new ApiError(401, 'La contraseña actual es incorrecta.');
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPass, 10) } });
  res.json({ ok: true });
}));

module.exports = router;
