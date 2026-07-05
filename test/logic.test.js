// Tests de lógica pura (sin base de datos). Ejecutar con: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { computeStatus } = require('../src/services/sale.service');
const salesRecord = require('../src/services/salesRecord.service');
const schemas = require('../src/schemas');

// ---------- computeStatus (estado de un crédito según total y abonado) ----------

test('computeStatus: sin abonos => PENDING', () => {
  assert.equal(computeStatus(10000, 0), 'PENDING');
});

test('computeStatus: abono parcial => PARTIAL', () => {
  assert.equal(computeStatus(10000, 4000), 'PARTIAL');
});

test('computeStatus: abono igual al total => PAID', () => {
  assert.equal(computeStatus(10000, 10000), 'PAID');
});

test('computeStatus: abono mayor al total => PAID', () => {
  assert.equal(computeStatus(10000, 12000), 'PAID');
});

// ---------- Validación de ventas ----------

test('saleCreate: acepta cantidades enviadas como texto', () => {
  const r = schemas.saleCreate.safeParse({ type: 'CASH', items: [{ productId: '3', quantity: '2', unitPrice: '5000' }] });
  assert.ok(r.success);
  assert.equal(r.data.items[0].productId, 3);
  assert.equal(r.data.items[0].quantity, 2);
});

test('saleCreate: rechaza venta sin productos', () => {
  const r = schemas.saleCreate.safeParse({ type: 'CASH', items: [] });
  assert.ok(!r.success);
});

test('saleCreate: rechaza cantidad cero o negativa', () => {
  assert.ok(!schemas.saleCreate.safeParse({ items: [{ productId: 1, quantity: 0 }] }).success);
  assert.ok(!schemas.saleCreate.safeParse({ items: [{ productId: 1, quantity: -3 }] }).success);
});

// ---------- Validación de productos ----------

test('productCreate: rechaza costo no numérico en vez de convertirlo a 0', () => {
  const r = schemas.productCreate.safeParse({ code: 'X1', name: 'Test', cost: 'abc' });
  assert.ok(!r.success);
});

test('productCreate: normaliza categoryId vacío a null', () => {
  const r = schemas.productCreate.safeParse({ code: 'X1', name: 'Test', categoryId: '' });
  assert.ok(r.success);
  assert.equal(r.data.categoryId, null);
});

test('productCreate: exige código y nombre', () => {
  assert.ok(!schemas.productCreate.safeParse({ name: 'Sin código' }).success);
  assert.ok(!schemas.productCreate.safeParse({ code: 'X1' }).success);
});

// ---------- Validación de abonos y login ----------

test('payment: rechaza abono negativo o cero', () => {
  assert.ok(!schemas.payment.safeParse({ amount: -1 }).success);
  assert.ok(!schemas.payment.safeParse({ amount: 0 }).success);
  assert.ok(schemas.payment.safeParse({ amount: '5000' }).success);
});

test('login: exige usuario y contraseña', () => {
  assert.ok(!schemas.login.safeParse({ username: 'admin' }).success);
  assert.ok(!schemas.login.safeParse({ password: 'x' }).success);
  assert.ok(schemas.login.safeParse({ username: 'admin', password: 'x' }).success);
});

test('userCreate: exige contraseña de al menos 6 caracteres', () => {
  assert.ok(!schemas.userCreate.safeParse({ username: 'juan', name: 'Juan', password: '123' }).success);
  assert.ok(schemas.userCreate.safeParse({ username: 'juan', name: 'Juan', password: '123456' }).success);
});

// ---------- Registro de ventas ----------

test('normalizeItems: separa contado y una línea por cliente a crédito', () => {
  const r = salesRecord.normalizeItems([
    { productId: 1, cashQty: 10, credits: [] },
    { productId: 2, cashQty: 0, credits: [] },
    { productId: 3, cashQty: 2, credits: [
      { qty: 3, customerCc: '111', customerName: 'Ana' },
      { qty: 1, customerCc: '999', customerName: 'Luis' },
    ] },
  ]);
  // 1 línea contado (p1) + 1 contado (p3) + 2 crédito (p3) = 4
  assert.equal(r.length, 4);
  assert.equal(r.filter((l) => l.kind === 'CREDIT').length, 2);
});

test('normalizeItems: un producto a crédito puede tener varios clientes', () => {
  const r = salesRecord.normalizeItems([
    { productId: 5, cashQty: 0, credits: [
      { qty: 4, customerCc: '111', customerName: 'Ana' },
      { qty: 6, customerCc: '222', customerName: 'Beto' },
    ] },
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((l) => l.customerCc).sort(), ['111', '222']);
});

test('normalizeItems: exige CC y nombre en cada línea de crédito', () => {
  assert.throws(() => salesRecord.normalizeItems([{ productId: 1, credits: [{ qty: 5 }] }]));
  assert.throws(() => salesRecord.normalizeItems([{ productId: 1, credits: [{ qty: 5, customerCc: '111' }] }]));
});

test('normalizeItems: rechaza registro totalmente vacío', () => {
  assert.throws(() => salesRecord.normalizeItems([{ productId: 1, cashQty: 0, credits: [] }]));
});

test('groupCreditsByClient: un crédito por cliente, agregando por producto', () => {
  const groups = salesRecord.groupCreditsByClient([
    { productId: 3, qty: 3, unitPrice: 1000, customerCc: '111', customerName: 'Ana', dueDate: null },
    { productId: 5, qty: 1, unitPrice: 2000, customerCc: '111', customerName: 'Ana', dueDate: null },
    { productId: 3, qty: 2, unitPrice: 1000, customerCc: '111', customerName: 'Ana', dueDate: null },
    { productId: 7, qty: 2, unitPrice: 500, customerCc: '999', customerName: 'Luis', dueDate: null },
  ]);
  assert.equal(groups.length, 2);
  const ana = groups.find((g) => g.cc === '111');
  assert.equal(ana.items.length, 2); // producto 3 y 5 (el 3 se agregó: 3+2=5)
  assert.equal(ana.items.find((i) => i.productId === 3).qty, 5);
  assert.equal(groups.find((g) => g.cc === '999').items.length, 1);
});
