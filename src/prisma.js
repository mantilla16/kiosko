// Cliente único de Prisma reutilizado en toda la aplicación
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
