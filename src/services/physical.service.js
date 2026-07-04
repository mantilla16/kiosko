const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');

// Crear un conteo físico (borrador) para el kiosko activo.
async function create(kioskId, { note, items, categoryId }) {
  let lines = [];

  if (categoryId && (!items || items.length === 0)) {
    const products = await prisma.product.findMany({ where: { kioskId, categoryId: Number(categoryId), active: true } });
    lines = products.map((p) => ({ productId: p.id, systemQty: p.stock, physicalQty: p.stock, difference: 0, observation: null }));
  } else {
    if (!Array.isArray(items) || items.length === 0)
      throw new ApiError(400, 'Debe registrar al menos un producto en el conteo.');
    for (const it of items) {
      const product = await prisma.product.findFirst({ where: { id: Number(it.productId), kioskId } });
      if (!product) throw new ApiError(404, `Producto ${it.productId} no existe en este kiosko.`);
      const physicalQty = Number(it.physicalQty);
      lines.push({
        productId: product.id,
        systemQty: product.stock,
        physicalQty,
        difference: physicalQty - product.stock,
        observation: it.observation || null,
      });
    }
  }

  return prisma.physicalInventory.create({
    data: { kioskId, note: note || null, status: 'DRAFT', items: { create: lines } },
    include: { items: { include: { product: true } } },
  });
}

function list(kioskId) {
  return prisma.physicalInventory.findMany({
    where: { kioskId },
    include: { items: { include: { product: true } } },
    orderBy: { date: 'desc' },
  });
}

function get(kioskId, id) {
  return prisma.physicalInventory.findFirst({
    where: { id: Number(id), kioskId },
    include: { items: { include: { product: true } } },
  });
}

async function approve(kioskId, id) {
  id = Number(id);
  return prisma.$transaction(async (tx) => {
    const inv = await tx.physicalInventory.findFirst({ where: { id, kioskId }, include: { items: true } });
    if (!inv) throw new ApiError(404, 'El inventario físico no existe en este kiosko.');
    if (inv.status === 'APPROVED') throw new ApiError(400, 'Este inventario ya fue aprobado.');

    for (const item of inv.items) {
      if (item.difference === 0) continue;
      await tx.product.update({ where: { id: item.productId }, data: { stock: item.physicalQty } });
      await tx.stockMovement.create({
        data: {
          kioskId,
          productId: item.productId,
          type: 'ADJUSTMENT',
          quantityIn: item.difference > 0 ? item.difference : 0,
          quantityOut: item.difference < 0 ? -item.difference : 0,
          reference: `Ajuste inventario físico #${inv.id}`,
        },
      });
    }

    return tx.physicalInventory.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { items: { include: { product: true } } },
    });
  });
}

module.exports = { create, list, get, approve };
