const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');

// Registrar una compra: crea la compra, AUMENTA el stock y deja el movimiento en el kardex.
async function create(kioskId, { productId, quantity, unitCost, supplier, date }) {
  productId = Number(productId);
  quantity = Number(quantity);
  unitCost = Number(unitCost);

  if (!productId) throw new ApiError(400, 'Debe seleccionar un producto.');
  if (!quantity || quantity <= 0) throw new ApiError(400, 'La cantidad debe ser mayor a cero.');
  if (unitCost < 0) throw new ApiError(400, 'El valor unitario no puede ser negativo.');

  const total = quantity * unitCost;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, kioskId } });
    if (!product) throw new ApiError(404, 'El producto no existe en este kiosko.');

    const purchase = await tx.purchase.create({
      data: {
        kioskId,
        productId,
        quantity,
        unitCost,
        total,
        supplier: supplier || product.supplier || null,
        date: date ? new Date(date) : undefined,
      },
    });

    await tx.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });

    await tx.stockMovement.create({
      data: {
        kioskId,
        productId,
        type: 'PURCHASE',
        quantityIn: quantity,
        date: date ? new Date(date) : undefined,
        reference: `Compra #${purchase.id}`,
      },
    });

    return tx.purchase.findUnique({ where: { id: purchase.id }, include: { product: true } });
  });
}

function list(kioskId, { from, to } = {}) {
  const where = { kioskId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(`${to}T23:59:59`);
  }
  return prisma.purchase.findMany({ where, include: { product: true }, orderBy: { date: 'desc' } });
}

module.exports = { create, list };
