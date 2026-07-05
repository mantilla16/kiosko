const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');

// Convierte el payload del formulario en líneas planas.
// items: [{ productId, cashQty, credits: [{ qty, customerCc, customerName, dueDate? }] }]
// Cada producto puede tener una porción de contado y varias porciones a crédito
// (una por cliente). Se devuelven líneas { productId, qty, kind, customerCc?, ... }.
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0)
    throw new ApiError(400, 'Debe registrar al menos un producto.');
  const lines = [];
  for (const it of items) {
    const productId = Number(it.productId);
    if (!productId) continue;

    const cashQty = Number(it.cashQty) || 0;
    if (cashQty < 0) throw new ApiError(400, 'Las cantidades no pueden ser negativas.');
    if (cashQty > 0) lines.push({ productId, qty: cashQty, kind: 'CASH', customerCc: null, customerName: null, dueDate: null });

    for (const c of it.credits || []) {
      const qty = Number(c.qty) || 0;
      if (qty <= 0) continue;
      const cc = (c.customerCc || '').trim();
      const name = (c.customerName || '').trim();
      if (!cc) throw new ApiError(400, 'Falta la cédula (CC) del cliente en una venta a crédito.');
      if (!name) throw new ApiError(400, `Falta el nombre del cliente con CC ${cc}.`);
      lines.push({ productId, qty, kind: 'CREDIT', customerCc: cc, customerName: name, dueDate: c.dueDate || null });
    }
  }
  if (lines.length === 0) throw new ApiError(400, 'Debe ingresar al menos una cantidad vendida.');
  return lines;
}

// Agrupa las líneas a crédito por cliente (CC): un crédito por cliente.
// Dentro de cada cliente, agrega las cantidades por producto.
function groupCreditsByClient(creditLines) {
  const map = new Map();
  for (const l of creditLines) {
    if (!map.has(l.customerCc))
      map.set(l.customerCc, { cc: l.customerCc, name: l.customerName, dueDate: l.dueDate, byProduct: new Map() });
    const g = map.get(l.customerCc);
    if (!g.dueDate && l.dueDate) g.dueDate = l.dueDate;
    const prev = g.byProduct.get(l.productId) || { productId: l.productId, unitPrice: l.unitPrice, qty: 0 };
    prev.qty += l.qty;
    g.byProduct.set(l.productId, prev);
  }
  return [...map.values()].map((g) => ({ cc: g.cc, name: g.name, dueDate: g.dueDate, items: [...g.byProduct.values()] }));
}

function withTotals(r) {
  const cashTotal = r.items.filter((i) => i.kind === 'CASH').reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const creditTotal = r.items.filter((i) => i.kind === 'CREDIT').reduce((a, i) => a + i.qty * i.unitPrice, 0);
  return { ...r, cashTotal, creditTotal, total: cashTotal + creditTotal };
}

// Añade el precio del producto (snapshot) a cada línea.
async function buildItemData(kioskId, lines) {
  const data = [];
  for (const l of lines) {
    const p = await prisma.product.findFirst({ where: { id: l.productId, kioskId } });
    if (!p) throw new ApiError(404, `El producto ${l.productId} no existe en este kiosko.`);
    data.push({
      productId: l.productId,
      unitPrice: p.price,
      qty: l.qty,
      kind: l.kind,
      customerCc: l.customerCc,
      customerName: l.customerName,
      dueDate: l.dueDate ? new Date(l.dueDate) : null,
    });
  }
  return data;
}

async function create(kioskId, { date, note, items }) {
  const lines = normalizeItems(items);
  const data = await buildItemData(kioskId, lines);
  const record = await prisma.salesRecord.create({
    data: {
      kioskId,
      note: note || null,
      date: date ? new Date(date) : undefined,
      status: 'DRAFT',
      items: { create: data },
    },
    include: { items: { include: { product: true } } },
  });
  return withTotals(record);
}

async function list(kioskId) {
  const records = await prisma.salesRecord.findMany({
    where: { kioskId },
    include: { items: { include: { product: true } } },
    orderBy: { date: 'desc' },
  });
  return records.map(withTotals);
}

async function get(kioskId, id) {
  const r = await prisma.salesRecord.findFirst({
    where: { id: Number(id), kioskId },
    include: { items: { include: { product: true } } },
  });
  if (!r) throw new ApiError(404, 'Registro de ventas no encontrado.');
  return withTotals(r);
}

async function update(kioskId, id, { date, note, items }) {
  id = Number(id);
  const existing = await prisma.salesRecord.findFirst({ where: { id, kioskId } });
  if (!existing) throw new ApiError(404, 'Registro de ventas no encontrado.');
  if (existing.status === 'APPROVED') throw new ApiError(400, 'Un registro aprobado no se puede editar.');
  const lines = normalizeItems(items);
  const data = await buildItemData(kioskId, lines);
  const record = await prisma.$transaction(async (tx) => {
    await tx.salesRecordItem.deleteMany({ where: { recordId: id } });
    await tx.salesRecord.update({
      where: { id },
      data: {
        note: note !== undefined ? (note || null) : existing.note,
        date: date ? new Date(date) : existing.date,
        items: { create: data },
      },
    });
    return tx.salesRecord.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
  });
  return withTotals(record);
}

// Aprobar: genera las ventas reales, descuenta stock y registra en el kardex.
async function approve(kioskId, id) {
  id = Number(id);
  return prisma.$transaction(async (tx) => {
    const record = await tx.salesRecord.findFirst({ where: { id, kioskId }, include: { items: true } });
    if (!record) throw new ApiError(404, 'Registro de ventas no encontrado.');
    if (record.status === 'APPROVED') throw new ApiError(400, 'Este registro ya fue aprobado.');
    if (record.items.length === 0) throw new ApiError(400, 'El registro no tiene ventas.');

    const names = {};
    for (const it of record.items) {
      const p = await tx.product.findFirst({ where: { id: it.productId, kioskId } });
      if (!p) throw new ApiError(404, `El producto ${it.productId} ya no existe.`);
      names[it.productId] = p.name;
    }

    async function sell(productId, qty, reference) {
      const dec = await tx.product.updateMany({
        where: { id: productId, kioskId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (dec.count !== 1)
        throw new ApiError(400, `Stock insuficiente de "${names[productId]}" para completar el registro.`);
      await tx.stockMovement.create({
        data: { kioskId, productId, type: 'SALE', quantityOut: qty, date: record.date, reference },
      });
    }

    // 1) Venta de CONTADO (una sola, agrupando por producto)
    const cashLines = record.items.filter((i) => i.kind === 'CASH');
    if (cashLines.length) {
      const byProduct = new Map();
      for (const l of cashLines) {
        const prev = byProduct.get(l.productId) || { productId: l.productId, unitPrice: l.unitPrice, qty: 0 };
        prev.qty += l.qty;
        byProduct.set(l.productId, prev);
      }
      const cashItems = [...byProduct.values()];
      const total = cashItems.reduce((a, i) => a + i.qty * i.unitPrice, 0);
      const sale = await tx.sale.create({
        data: {
          kioskId, type: 'CASH', total, date: record.date,
          items: { create: cashItems.map((i) => ({ productId: i.productId, quantity: i.qty, unitPrice: i.unitPrice, total: i.qty * i.unitPrice })) },
        },
      });
      for (const i of cashItems) await sell(i.productId, i.qty, `Contado · registro #${record.id} · venta #${sale.id}`);
    }

    // 2) Ventas a CRÉDITO: una por cliente, con número secuencial
    const creditGroups = groupCreditsByClient(record.items.filter((i) => i.kind === 'CREDIT'));
    if (creditGroups.length) {
      const agg = await tx.sale.aggregate({ where: { kioskId, creditNumber: { not: null } }, _max: { creditNumber: true } });
      let nextCredit = (agg._max.creditNumber || 0) + 1;

      for (const g of creditGroups) {
        let customer = await tx.customer.findFirst({ where: { kioskId, cc: g.cc } });
        if (!customer) customer = await tx.customer.create({ data: { kioskId, cc: g.cc, name: g.name } });

        const total = g.items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
        await tx.sale.create({
          data: {
            kioskId, type: 'CREDIT', total, creditNumber: nextCredit, customerId: customer.id,
            date: record.date, status: 'PENDING', dueDate: g.dueDate ? new Date(g.dueDate) : null,
            items: { create: g.items.map((i) => ({ productId: i.productId, quantity: i.qty, unitPrice: i.unitPrice, total: i.qty * i.unitPrice })) },
          },
        });
        for (const i of g.items) await sell(i.productId, i.qty, `Crédito #${nextCredit} · registro #${record.id}`);
        nextCredit++;
      }
    }

    await tx.salesRecord.update({ where: { id }, data: { status: 'APPROVED' } });
    return { ok: true };
  });
}

async function remove(kioskId, id) {
  id = Number(id);
  const r = await prisma.salesRecord.findFirst({ where: { id, kioskId } });
  if (!r) throw new ApiError(404, 'Registro de ventas no encontrado.');
  if (r.status === 'APPROVED') throw new ApiError(400, 'Un registro aprobado no se puede eliminar.');
  await prisma.salesRecord.delete({ where: { id } });
  return { ok: true };
}

module.exports = { create, list, get, update, approve, remove, normalizeItems, groupCreditsByClient };
