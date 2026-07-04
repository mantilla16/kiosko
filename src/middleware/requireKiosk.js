const prisma = require('../prisma');
const ApiError = require('../utils/ApiError');

// Identifica el kiosko activo a partir de la cabecera X-Kiosk-Id.
// Se aplica a todas las rutas de datos (productos, ventas, etc.).
module.exports = async function requireKiosk(req, res, next) {
  try {
    const id = Number(req.header('x-kiosk-id'));
    if (!id) throw new ApiError(400, 'No se ha seleccionado un kiosko.');
    const kiosk = await prisma.kiosk.findUnique({ where: { id } });
    if (!kiosk) throw new ApiError(404, 'El kiosko seleccionado no existe.');
    req.kioskId = id;
    next();
  } catch (e) {
    next(e);
  }
};
