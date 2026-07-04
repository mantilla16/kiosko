const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');

function computeStatus(total, paid) {
  if (paid >= total) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'PENDING';
}

// Registrar una venta (contado o crédito). Descuenta stock y deja movimiento en el kardex.
async function create(kioskId, { items, type = 'CASH', customer, customerId, dueDate, date }) {
  if (!Array.isArray(items) || items.length === 0)
    throw new ApiError(400, 'Debe agregar al menos un producto a la venta.');

  const normalized = items.map((it) => ({
    productId: Number(it.productId),
    quantity: Number(it.quantity),
    unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
  }));

  for (const it of normalized) {
    if (!it.productId) throw new ApiError(400, 'Hay un producto inválido en la venta.');
    if (!it.quantity || it.quantity <= 0) throw new ApiError(400, 'Las cantidades deben ser mayores a cero.');
  }

  return prisma.$transaction(async (tx) => {
    let resolvedCustomerId = customerId ? Number(customerId) : null;
    if (type === 'CREDIT' && !resolvedCustomerId) {
      if (!customer || !customer.trim()) throw new ApiError(400, 'Una venta a crédito requiere un cliente.');
      const existing = await tx.customer.findFirst({ where: { kioskId, name: customer.trim() } });
      resolvedCustomerId = existing
        ? existing.id
        : (await tx.customer.create({ data: { kioskId, name: customer.trim() } })).id;
    }

    const lineData = [];
    const names = {};
    let total = 0;
    for (const it of normalized) {
      const product = await tx.product.findFirst({ where: { id: it.productId, kioskId } });
      if (!product) throw new ApiError(404, `Producto ${it.productId} no existe en este kiosko.`);
      if (product.stock < it.quantity)
        throw new ApiError(400, `Stock insuficiente de "${product.name}". Disponible: ${product.stock}, solicitado: ${it.quantity}.`);
      const unitPrice = it.unitPrice != null ? it.unitPrice : product.price;
      const lineTotal = unitPrice * it.quantity;
      total += lineTotal;
      names[it.productId] = product.name;
      lineData.push({ productId: it.productId, quantity: it.quantity, unitPrice, total: lineTotal });
    }

    const sale = await tx.sale.create({
      data: {
        kioskId,
        type,
        total,
        date: date ? new Date(date) : undefined,
        customerId: resolvedCustomerId,
        dueDate: type === 'CREDIT' && dueDate ? new Date(dueDate) : null,
        status: type === 'CREDIT' ? 'PENDING' : null,
        items: { create: lineData },
      },
    });

    for (const line of lineData) {
      // Descuento atómico: solo baja el stock si sigue habiendo suficiente.
      // Evita que dos ventas simultáneas del mismo producto dejen el stock negativo.
      const dec = await tx.product.updateMany({
        where: { id: line.productId, kioskId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (dec.count !== 1)
        throw new ApiError(400, `Stock insuficiente de "${names[line.productId]}" (otra venta lo modificó). Intenta de nuevo.`);
      await tx.stockMovement.create({
        data: {
          kioskId,
          productId: line.productId,
          type: 'SALE',
          quantityOut: line.quantity,
          date: date ? new Date(date) : undefined,
          reference: `Venta #${sale.id}`,
        },
      });
    }

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: { items: { include: { product: true } }, customer: true, payments: true },
    });
  });
}

function list(kioskId, { from, to, type } = {}) {
  const where = { kioskId };
  if (type) where.type = type;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(`${to}T23:59:59`);
  }
  return prisma.sale.findMany({
    where,
    include: { items: { include: { product: true } }, customer: true, payments: true },
    orderBy: { date: 'desc' },
  });
}

// ----- Cartera -----

async function listCredits(kioskId, { onlyPending } = {}) {
  const sales = await prisma.sale.findMany({
    where: { kioskId, type: 'CREDIT' },
    include: { customer: true, payments: true, items: { include: { product: true } } },
    orderBy: { date: 'desc' },
  });
  const result = sales.map((s) => {
    const paid = s.payments.reduce((a, p) => a + p.amount, 0);
    return { ...s, paid, balance: s.total - paid };
  });
  return onlyPending ? result.filter((s) => s.balance > 0.0001) : result;
}

async function addPayment(kioskId, saleId, amount, date) {
  saleId = Number(saleId);
  amount = Number(amount);
  if (!amount || amount <= 0) throw new ApiError(400, 'El abono debe ser mayor a cero.');

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId, kioskId }, include: { payments: true } });
    if (!sale) throw new ApiError(404, 'El crédito no existe en este kiosko.');
    if (sale.type !== 'CREDIT') throw new ApiError(400, 'La venta no es a crédito.');

    const paid = sale.payments.reduce((a, p) => a + p.amount, 0);
    const balance = sale.total - paid;
    if (amount > balance + 0.0001) throw new ApiError(400, `El abono supera el saldo pendiente (${balance}).`);

    await tx.payment.create({ data: { saleId, amount, date: date ? new Date(date) : undefined } });
    await tx.sale.update({ where: { id: saleId }, data: { status: computeStatus(sale.total, paid + amount) } });

    return tx.sale.findUnique({ where: { id: saleId }, include: { payments: true, customer: true } });
  });
}

async function listCustomers(kioskId) {
  return prisma.customer.findMany({ where: { kioskId }, orderBy: { name: 'asc' } });
}

async function customerHistory(kioskId, customerId) {
  customerId = Number(customerId);
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, kioskId },
    include: {
      sales: {
        where: { type: 'CREDIT' },
        include: { payments: true, items: { include: { product: true } } },
        orderBy: { date: 'desc' },
      },
    },
  });
  if (!customer) throw new ApiError(404, 'El cliente no existe en este kiosko.');

  let totalDebt = 0;
  let lastPaymentDate = null;
  const sales = customer.sales.map((s) => {
    const paid = s.payments.reduce((a, p) => a + p.amount, 0);
    totalDebt += s.total - paid;
    for (const p of s.payments) {
      if (!lastPaymentDate || new Date(p.date) > new Date(lastPaymentDate)) lastPaymentDate = p.date;
    }
    return { ...s, paid, balance: s.total - paid };
  });

  return { customer: { id: customer.id, name: customer.name, phone: customer.phone }, sales, totalDebt, lastPaymentDate };
}

module.exports = { create, list, listCredits, addPayment, listCustomers, customerHistory, computeStatus };
