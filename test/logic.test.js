// Tests de lógica pura (sin base de datos). Ejecutar con: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { computeStatus } = require('../src/services/sale.service');
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
