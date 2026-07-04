const router = require('express').Router();
const prisma = require('../prisma');
const ah = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Listar categorías del kiosko activo con sus subcategorías
router.get('/', ah(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { kioskId: req.kioskId },
    include: { subcategories: { orderBy: { name: 'asc' } }, _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(categories);
}));

router.post('/', ah(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'El nombre de la categoría es obligatorio.');
  const exists = await prisma.category.findFirst({ where: { kioskId: req.kioskId, name: name.trim() } });
  if (exists) throw new ApiError(400, 'Ya existe esa categoría en este kiosko.');
  const cat = await prisma.category.create({ data: { name: name.trim(), kioskId: req.kioskId } });
  res.status(201).json(cat);
}));

router.put('/:id', ah(async (req, res) => {
  const { name } = req.body;
  const cat = await prisma.category.findFirst({ where: { id: Number(req.params.id), kioskId: req.kioskId } });
  if (!cat) throw new ApiError(404, 'Categoría no encontrada.');
  const updated = await prisma.category.update({ where: { id: cat.id }, data: { name: name.trim() } });
  res.json(updated);
}));

router.delete('/:id', ah(async (req, res) => {
  const cat = await prisma.category.findFirst({ where: { id: Number(req.params.id), kioskId: req.kioskId } });
  if (!cat) throw new ApiError(404, 'Categoría no encontrada.');
  const count = await prisma.product.count({ where: { categoryId: cat.id } });
  if (count > 0) throw new ApiError(400, 'No se puede eliminar: hay productos en esta categoría.');
  await prisma.category.delete({ where: { id: cat.id } });
  res.json({ ok: true });
}));

// Subcategorías
router.post('/:id/subcategories', ah(async (req, res) => {
  const cat = await prisma.category.findFirst({ where: { id: Number(req.params.id), kioskId: req.kioskId } });
  if (!cat) throw new ApiError(404, 'Categoría no encontrada.');
  const { name } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'El nombre de la subcategoría es obligatorio.');
  const sub = await prisma.subcategory.create({ data: { name: name.trim(), categoryId: cat.id } });
  res.status(201).json(sub);
}));

// Renombrar subcategoría
router.put('/subcategories/:subId', ah(async (req, res) => {
  const sub = await prisma.subcategory.findUnique({ where: { id: Number(req.params.subId) }, include: { category: true } });
  if (!sub || sub.category.kioskId !== req.kioskId) throw new ApiError(404, 'Subcategoría no encontrada.');
  const { name } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'El nombre de la subcategoría es obligatorio.');
  const updated = await prisma.subcategory.update({ where: { id: sub.id }, data: { name: name.trim() } });
  res.json(updated);
}));

router.delete('/subcategories/:subId', ah(async (req, res) => {
  // Verificar que la subcategoría pertenezca a una categoría del kiosko activo
  const sub = await prisma.subcategory.findUnique({ where: { id: Number(req.params.subId) }, include: { category: true } });
  if (!sub || sub.category.kioskId !== req.kioskId) throw new ApiError(404, 'Subcategoría no encontrada.');
  await prisma.subcategory.delete({ where: { id: sub.id } });
  res.json({ ok: true });
}));

module.exports = router;
