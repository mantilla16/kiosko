// Datos iniciales: kioskos de ejemplo, categorías, subcategorías, productos y usuario admin.
// Ejecutar con: npm run db:seed
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const CATEGORIES = {
  Bebidas: ['Agua', 'Gaseosas', 'Jugos', 'Energizantes'],
  Snacks: ['Papas', 'Chitos', 'Maní', 'Galletas'],
  Dulces: ['Chocolates', 'Chicles', 'Bombones'],
  Caballistas: ['Gatorade', 'Agua grande', 'Barras energéticas'],
  Insumos: ['Vasos', 'Servilletas', 'Hielo', 'Bolsas'],
};

const PRODUCTS = [
  { code: 'B001', name: 'Coca-Cola 400 ml', category: 'Bebidas', sub: 'Gaseosas', unit: 'Unidad', supplier: 'Olímpica', cost: 3000, price: 5000, minStock: 5, stock: 20 },
  { code: 'B002', name: 'Agua Cristal 600 ml', category: 'Bebidas', sub: 'Agua', unit: 'Unidad', supplier: 'Postobón', cost: 1200, price: 2500, minStock: 10, stock: 15 },
  { code: 'C001', name: 'Gatorade 500 ml', category: 'Caballistas', sub: 'Gatorade', unit: 'Unidad', supplier: 'Olímpica', cost: 3500, price: 6000, minStock: 6, stock: 10 },
  { code: 'C002', name: 'Agua botellón grande', category: 'Caballistas', sub: 'Agua grande', unit: 'Unidad', supplier: 'Brisa', cost: 5000, price: 8000, minStock: 4, stock: 4 },
  { code: 'S001', name: 'Papas Margarita', category: 'Snacks', sub: 'Papas', unit: 'Unidad', supplier: 'Frito Lay', cost: 1500, price: 3000, minStock: 8, stock: 25 },
  { code: 'D001', name: 'Chocolatina Jet', category: 'Dulces', sub: 'Chocolates', unit: 'Unidad', supplier: 'Nutresa', cost: 800, price: 1500, minStock: 10, stock: 30 },
  { code: 'I001', name: 'Vaso desechable 9 oz', category: 'Insumos', sub: 'Vasos', unit: 'Paquete', supplier: 'Olímpica', cost: 4000, price: 0, minStock: 2, stock: 5 },
];

// Crea las categorías/subcategorías de un kiosko. Devuelve mapas de ids.
async function seedCategories(kioskId) {
  const catMap = {}, subMap = {};
  for (const [catName, subs] of Object.entries(CATEGORIES)) {
    const cat = await prisma.category.upsert({
      where: { kioskId_name: { kioskId, name: catName } },
      update: {},
      create: { name: catName, kioskId },
    });
    catMap[catName] = cat.id;
    for (const subName of subs) {
      const sub = await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: cat.id, name: subName } },
        update: {},
        create: { name: subName, categoryId: cat.id },
      });
      subMap[`${catName}|${subName}`] = sub.id;
    }
  }
  return { catMap, subMap };
}

async function seedProducts(kioskId, catMap, subMap) {
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { kioskId, code: p.code } });
    if (existing) continue;
    const created = await prisma.product.create({
      data: {
        kioskId,
        code: p.code,
        name: p.name,
        categoryId: catMap[p.category] || null,
        subcategoryId: subMap[`${p.category}|${p.sub}`] || null,
        unit: p.unit,
        supplier: p.supplier,
        cost: p.cost,
        price: p.price,
        minStock: p.minStock,
        stock: p.stock,
        active: true,
      },
    });
    if (p.stock > 0) {
      await prisma.stockMovement.create({
        data: { kioskId, productId: created.id, type: 'INITIAL', quantityIn: p.stock, reference: 'Stock inicial' },
      });
    }
  }
}

async function seedAdminUser() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existing) return;
  await prisma.user.create({
    data: {
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      name: 'Administrador',
      role: 'ADMIN',
      active: true,
    },
  });
  console.log('Usuario admin creado → usuario: admin | contraseña: admin123');
  console.log('⚠  IMPORTANTE: cambia esta contraseña desde la app apenas inicies sesión.');
}

async function main() {
  console.log('Sembrando datos iniciales...');
  await seedAdminUser();

  // Kiosko 1: con catálogo de ejemplo
  const principal = await prisma.kiosk.upsert({
    where: { name: 'Kiosco Principal' },
    update: {},
    create: { name: 'Kiosco Principal' },
  });
  const { catMap, subMap } = await seedCategories(principal.id);
  await seedProducts(principal.id, catMap, subMap);

  // Kiosko 2: misma estructura de categorías, sin productos (para demostrar separación)
  const segundo = await prisma.kiosk.upsert({
    where: { name: 'Kiosco Pesebrera' },
    update: {},
    create: { name: 'Kiosco Pesebrera' },
  });
  await seedCategories(segundo.id);

  console.log(`Listo. Kioskos: 2 | "${principal.name}" con ${PRODUCTS.length} productos | "${segundo.name}" vacío.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
