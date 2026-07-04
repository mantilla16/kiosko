const router = require('express').Router();
const prisma = require('../prisma');
const ah = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const validate = require('../middleware/validate');
const schemas = require('../schemas');

// Listar productos del kiosko activo (con filtros opcionales)
router.get('/', ah(async (req, res) => {
  const { q, categoryId, active } = req.query;
  const where = { kioskId: req.kioskId };
  if (q) where.OR = [
    { name: { contains: q, mode: 'insensitive' } },
    { code: { contains: q, mode: 'insensitive' } },
  ];
  if (categoryId) where.categoryId = Number(categoryId);
  if (active === 'true') where.active = true;
  if (active === 'false') where.active = false;

  const products = await prisma.product.findMany({
    where,
    include: { category: true, subcategory: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
}));

router.get('/:id', ah(async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: Number(req.params.id), kioskId: req.kioskId },
    include: { category: true, subcategory: true },
  });
  if (!product) throw new ApiError(404, 'Producto no encontrado.');
  res.json(product);
}));

// Crear producto. Si trae stock inicial, se registra como movimiento INITIAL.
router.post('/', validate(schemas.productCreate), ah(async (req, res) => {
  const b = req.body;

  const exists = await prisma.product.findFirst({ where: { kioskId: req.kioskId, code: b.code.trim() } });
  if (exists) throw new ApiError(400, `Ya existe un producto con el código ${b.code} en este kiosko.`);

  const stock = Number(b.stock) || 0;

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        kioskId: req.kioskId,
        code: b.code.trim(),
        name: b.name.trim(),
        categoryId: b.categoryId ? Number(b.categoryId) : null,
        subcategoryId: b.subcategoryId ? Number(b.subcategoryId) : null,
        unit: b.unit || 'Unidad',
        supplier: b.supplier || null,
        cost: Number(b.cost) || 0,
        price: Number(b.price) || 0,
        minStock: Number(b.minStock) || 0,
        stock,
        active: b.active !== undefined ? !!b.active : true,
      },
    });
    if (stock > 0) {
      await tx.stockMovement.create({
        data: { kioskId: req.kioskId, productId: p.id, type: 'INITIAL', quantityIn: stock, reference: 'Stock inicial' },
      });
    }
    return p;
  });

  res.status(201).json(product);
}));

// Actualizar producto (no toca el stock directamente para no romper el kardex)
router.put('/:id', validate(schemas.productUpdate), ah(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const product = await prisma.product.findFirst({ where: { id, kioskId: req.kioskId } });
  if (!product) throw new ApiError(404, 'Producto no encontrado.');

  if (b.code && b.code.trim() !== product.code) {
    const dup = await prisma.product.findFirst({ where: { kioskId: req.kioskId, code: b.code.trim() } });
    if (dup) throw new ApiError(400, `Ya existe un producto con el código ${b.code} en este kiosko.`);
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      code: b.code !== undefined ? b.code.trim() : undefined,
      name: b.name !== undefined ? b.name.trim() : undefined,
      categoryId: b.categoryId !== undefined ? (b.categoryId ? Number(b.categoryId) : null) : undefined,
      subcategoryId: b.subcategoryId !== undefined ? (b.subcategoryId ? Number(b.subcategoryId) : null) : undefined,
      unit: b.unit,
      supplier: b.supplier,
      cost: b.cost !== undefined ? Number(b.cost) : undefined,
      price: b.price !== undefined ? Number(b.price) : undefined,
      minStock: b.minStock !== undefined ? Number(b.minStock) : undefined,
      active: b.active !== undefined ? !!b.active : undefined,
    },
  });
  res.json(updated);
}));

// Ajuste manual de stock (entrada o salida). Queda registrado en el kardex.
router.post('/:id/stock-adjustment', validate(schemas.stockAdjustment), ah(async (req, res) => {
  const id = Number(req.params.id);
  const qty = req.body.quantity;

  const product = await prisma.product.findFirst({ where: { id, kioskId: req.kioskId } });
  if (!product) throw new ApiError(404, 'Producto no encontrado.');

  const updated = await prisma.$transaction(async (tx) => {
    if (product.stock + qty < 0)
      throw new ApiError(400, `El ajuste dejaría el stock negativo (actual ${product.stock}).`);
    await tx.product.update({ where: { id }, data: { stock: { increment: qty } } });
    await tx.stockMovement.create({
      data: {
        kioskId: req.kioskId,
        productId: id,
        type: 'ADJUSTMENT',
        quantityIn: qty > 0 ? qty : 0,
        quantityOut: qty < 0 ? -qty : 0,
        reference: req.body.reason ? req.body.reason : 'Ajuste manual de stock',
      },
    });
    return tx.product.findUnique({ where: { id } });
  });
  res.json(updated);
}));

// Eliminar producto.
// Por defecto borra solo si NO tiene movimientos.
// Con ?force=true elimina también todo su historial (movimientos, compras, ventas, conteos).
router.delete('/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  const force = req.query.force === 'true';
  const product = await prisma.product.findFirst({ where: { id, kioskId: req.kioskId } });
  if (!product) throw new ApiError(404, 'Producto no encontrado.');

  const movements = await prisma.stockMovement.count({ where: { productId: id } });
  if (movements > 0 && !force) {
    // 409: el frontend ofrecerá el borrado forzado
    throw new ApiError(409, 'El producto tiene movimientos asociados.');
  }

  await prisma.$transaction(async (tx) => {
    // Eliminar dependencias para no violar las llaves foráneas
    await tx.stockMovement.deleteMany({ where: { productId: id } });
    await tx.saleItem.deleteMany({ where: { productId: id } });
    await tx.purchase.deleteMany({ where: { productId: id } });
    await tx.physicalInventoryItem.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
  });
  res.json({ ok: true });
}));

module.exports = router;
