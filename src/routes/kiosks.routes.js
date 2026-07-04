const router = require('express').Router();
const prisma = require('../prisma');
const ah = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const schemas = require('../schemas');

// Listar kioskos (con conteo de productos)
router.get('/', ah(async (req, res) => {
  const kiosks = await prisma.kiosk.findMany({
    include: { _count: { select: { products: true, sales: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(kiosks);
}));

// Crear kiosko. Opcionalmente replica un set de categorías iniciales.
router.post('/', requireAdmin, validate(schemas.kioskCreate), ah(async (req, res) => {
  const { name, seedCategories } = req.body;
  const exists = await prisma.kiosk.findUnique({ where: { name: name.trim() } });
  if (exists) throw new ApiError(400, 'Ya existe un kiosko con ese nombre.');

  const DEFAULTS = {
    Bebidas: ['Agua', 'Gaseosas', 'Jugos', 'Energizantes'],
    Snacks: ['Papas', 'Chitos', 'Maní', 'Galletas'],
    Dulces: ['Chocolates', 'Chicles', 'Bombones'],
    Caballistas: ['Gatorade', 'Agua grande', 'Barras energéticas'],
    Insumos: ['Vasos', 'Servilletas', 'Hielo', 'Bolsas'],
  };

  const kiosk = await prisma.$transaction(async (tx) => {
    const k = await tx.kiosk.create({ data: { name: name.trim() } });
    if (seedCategories) {
      for (const [cat, subs] of Object.entries(DEFAULTS)) {
        const c = await tx.category.create({ data: { name: cat, kioskId: k.id } });
        for (const s of subs) await tx.subcategory.create({ data: { name: s, categoryId: c.id } });
      }
    }
    return k;
  });
  res.status(201).json(kiosk);
}));

router.put('/:id', requireAdmin, validate(schemas.kioskUpdate), ah(async (req, res) => {
  const { name, active } = req.body;
  const kiosk = await prisma.kiosk.update({
    where: { id: Number(req.params.id) },
    data: { name: name ? name.trim() : undefined, active: active !== undefined ? !!active : undefined },
  });
  res.json(kiosk);
}));

// Eliminar kiosko (elimina TODA su información en cascada)
router.delete('/:id', requireAdmin, ah(async (req, res) => {
  await prisma.kiosk.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}));

module.exports = router;
