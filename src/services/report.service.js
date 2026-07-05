const prisma = require('../prisma');

// Kardex de un producto del kiosko activo.
async function kardex(kioskId, productId) {
  productId = Number(productId);
  const product = await prisma.product.findFirst({ where: { id: productId, kioskId } });
  if (!product) return null;

  const movements = await prisma.stockMovement.findMany({
    where: { productId, kioskId },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });

  let balance = 0;
  const rows = movements.map((m) => {
    balance += m.quantityIn - m.quantityOut;
    return { id: m.id, date: m.date, type: m.type, reference: m.reference, quantityIn: m.quantityIn, quantityOut: m.quantityOut, balance };
  });

  return { product, movements: rows };
}

async function inventoryControl(kioskId) {
  const products = await prisma.product.findMany({
    where: { kioskId },
    include: { category: true, movements: true },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category ? p.category.name : null,
    unit: p.unit,
    entradas: p.movements.reduce((a, m) => a + m.quantityIn, 0),
    salidas: p.movements.reduce((a, m) => a + m.quantityOut, 0),
    existencia: p.stock,
    minStock: p.minStock,
    active: p.active,
  }));
}

async function lowStock(kioskId) {
  const products = await prisma.product.findMany({
    where: { kioskId, active: true },
    include: { category: true },
    orderBy: { name: 'asc' },
  });
  return products
    .filter((p) => p.stock <= p.minStock)
    .map((p) => ({
      code: p.code,
      name: p.name,
      category: p.category ? p.category.name : null,
      stock: p.stock,
      minStock: p.minStock,
      faltante: Math.max(0, p.minStock - p.stock),
    }));
}

async function profit(kioskId) {
  const products = await prisma.product.findMany({
    where: { kioskId },
    include: { saleItems: true },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => {
    const soldQty = p.saleItems.reduce((a, s) => a + s.quantity, 0);
    const revenue = p.saleItems.reduce((a, s) => a + s.total, 0);
    return {
      code: p.code,
      name: p.name,
      cost: p.cost,
      price: p.price,
      unitProfit: p.price - p.cost,
      soldQty,
      revenue,
      totalProfit: revenue - soldQty * p.cost,
    };
  });
}

async function salesByDay(kioskId, { from, to } = {}) {
  const where = { kioskId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(`${to}T23:59:59`);
  }
  const sales = await prisma.sale.findMany({ where, orderBy: { date: 'asc' } });

  const map = new Map();
  for (const s of sales) {
    const key = new Date(s.date).toISOString().slice(0, 10);
    const entry = map.get(key) || { date: key, total: 0, cash: 0, credit: 0, count: 0 };
    entry.total += s.total;
    if (s.type === 'CREDIT') entry.credit += s.total;
    else entry.cash += s.total;
    entry.count += 1;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

async function dashboard(kioskId) {
  const [products, lowStockList, customers] = await Promise.all([
    prisma.product.findMany({ where: { kioskId } }),
    lowStock(kioskId),
    prisma.customer.count({ where: { kioskId } }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const todaySales = await prisma.sale.findMany({
    where: { kioskId, date: { gte: new Date(`${today}T00:00:00`), lte: new Date(`${today}T23:59:59`) } },
  });
  const credits = await prisma.sale.findMany({ where: { kioskId, type: 'CREDIT' }, include: { payments: true } });
  const receivable = credits.reduce((acc, s) => acc + (s.total - s.payments.reduce((a, p) => a + p.amount, 0)), 0);

  return {
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.active).length,
    lowStockCount: lowStockList.length,
    todaySalesTotal: todaySales.reduce((a, s) => a + s.total, 0),
    todaySalesCash: todaySales.filter((s) => s.type !== 'CREDIT').reduce((a, s) => a + s.total, 0),
    todaySalesCredit: todaySales.filter((s) => s.type === 'CREDIT').reduce((a, s) => a + s.total, 0),
    todaySalesCount: todaySales.length,
    receivable,
    customers,
    inventoryValueCost: products.reduce((a, p) => a + p.stock * p.cost, 0),
    inventoryValuePrice: products.reduce((a, p) => a + p.stock * p.price, 0),
    lowStockList: lowStockList.slice(0, 8),
  };
}

module.exports = { kardex, inventoryControl, lowStock, profit, salesByDay, dashboard };
