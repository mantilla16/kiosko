const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const ah = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const schemas = require('../schemas');

// Todas las rutas de usuarios requieren rol ADMIN
router.use(requireAdmin);

const SELECT = { id: true, username: true, name: true, role: true, active: true, createdAt: true };

// Listar usuarios
router.get('/', ah(async (req, res) => {
  const users = await prisma.user.findMany({ select: SELECT, orderBy: { name: 'asc' } });
  res.json(users);
}));

// Crear usuario
router.post('/', validate(schemas.userCreate), ah(async (req, res) => {
  const { username, password, name, role, active } = req.body;
  const exists = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (exists) throw new ApiError(400, 'El nombre de usuario ya está en uso.');
  const user = await prisma.user.create({
    data: {
      username: username.trim(),
      password: await bcrypt.hash(password, 10),
      name: name.trim(),
      role: role === 'ADMIN' ? 'ADMIN' : 'OPERADOR',
      active: active !== false,
    },
    select: SELECT,
  });
  res.status(201).json(user);
}));

// Editar usuario
router.put('/:id', validate(schemas.userUpdate), ah(async (req, res) => {
  const id = Number(req.params.id);
  const { name, role, active, password } = req.body;
  // No puede cambiar su propio rol
  if (id === req.user.id && role && role !== req.user.role) {
    throw new ApiError(400, 'No puedes cambiar tu propio rol.');
  }
  const data = {};
  if (name) data.name = name.trim();
  if (role) data.role = role;
  if (active !== undefined) data.active = active;
  if (password) data.password = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id }, data, select: SELECT });
  res.json(user);
}));

// Eliminar usuario
router.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new ApiError(400, 'No puedes eliminar tu propio usuario.');
  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
}));

module.exports = router;
