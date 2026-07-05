// Schemas de validación (zod) para los endpoints de mutación.
// Usan coerción suave: aceptan números enviados como texto (formularios) pero
// rechazan valores claramente inválidos (vacíos obligatorios, negativos, NaN, enums erróneos).
const { z } = require('zod');

const trimmed = (min, msg) => z.string({ error: msg }).trim().min(min, msg);

// id opcional: "", null o ausente => null; si viene, entero positivo
const optionalId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.number({ error: 'Debe ser un número.' }).int().positive().nullable()
);

const money = z.coerce.number({ error: 'Debe ser un número.' }).min(0, 'No puede ser negativo.');
const positiveInt = z.coerce.number({ error: 'Debe ser un número.' }).int().positive('Debe ser mayor a cero.');
const nonNegInt = z.coerce.number({ error: 'Debe ser un número.' }).int().min(0, 'No puede ser negativo.');

// ----- Autenticación -----
const login = z.object({
  username: trimmed(1, 'El usuario es obligatorio.'),
  password: z.string({ error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.'),
});

const changePassword = z.object({
  current: z.string().min(1, 'La contraseña actual es obligatoria.'),
  newPass: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres.'),
});

// ----- Usuarios -----
const roleEnum = z.enum(['ADMIN', 'OPERADOR']);

const userCreate = z.object({
  username: trimmed(3, 'El usuario debe tener al menos 3 caracteres.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  name: trimmed(1, 'El nombre es obligatorio.'),
  role: roleEnum.optional(),
  active: z.boolean().optional(),
});

const userUpdate = z.object({
  name: trimmed(1, 'El nombre no puede estar vacío.').optional(),
  role: roleEnum.optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional(),
});

// ----- Productos -----
const productCreate = z.object({
  code: trimmed(1, 'El código es obligatorio.'),
  name: trimmed(1, 'El nombre es obligatorio.'),
  categoryId: optionalId,
  subcategoryId: optionalId,
  unit: z.string().trim().optional(),
  supplier: z.string().trim().nullish(),
  cost: money.optional(),
  price: money.optional(),
  minStock: nonNegInt.optional(),
  stock: nonNegInt.optional(),
  active: z.boolean().optional(),
});

const productUpdate = productCreate.partial();

const stockAdjustment = z.object({
  quantity: z.coerce.number({ error: 'Ingrese una cantidad.' }).int().refine((n) => n !== 0, 'La cantidad debe ser distinta de cero.'),
  reason: z.string().trim().optional(),
});

// ----- Ventas -----
const saleCreate = z.object({
  type: z.enum(['CASH', 'CREDIT']).default('CASH'),
  items: z.array(z.object({
    productId: positiveInt,
    quantity: positiveInt,
    unitPrice: money.optional(),
  })).min(1, 'Debe agregar al menos un producto a la venta.'),
  customer: z.string().trim().optional(),
  customerId: optionalId,
  dueDate: z.string().optional(),
  date: z.string().optional(),
});

// ----- Compras -----
const purchaseCreate = z.object({
  productId: positiveInt,
  quantity: positiveInt,
  unitCost: money,
  supplier: z.string().trim().nullish(),
  date: z.string().optional(),
});

// ----- Cartera / abonos -----
const payment = z.object({
  amount: z.coerce.number({ error: 'El abono debe ser un número.' }).positive('El abono debe ser mayor a cero.'),
  date: z.string().optional(),
});

// ----- Registro de ventas -----
const salesRecordCreate = z.object({
  date: z.string().optional(),
  note: z.string().trim().nullish(),
  items: z.array(z.object({
    productId: positiveInt,
    cashQty: nonNegInt.optional(),
    credits: z.array(z.object({
      qty: nonNegInt.optional(),
      customerCc: z.string().trim().optional(),
      customerName: z.string().trim().optional(),
      dueDate: z.string().optional(),
    })).optional(),
  })).min(1, 'Debe registrar al menos un producto.'),
});

// ----- Kioskos -----
const kioskCreate = z.object({
  name: trimmed(1, 'El nombre del kiosko es obligatorio.'),
  seedCategories: z.boolean().optional(),
});

const kioskUpdate = z.object({
  name: trimmed(1, 'El nombre no puede estar vacío.').optional(),
  active: z.boolean().optional(),
});

module.exports = {
  login, changePassword,
  userCreate, userUpdate,
  productCreate, productUpdate, stockAdjustment,
  saleCreate, purchaseCreate, payment,
  salesRecordCreate,
  kioskCreate, kioskUpdate,
};
