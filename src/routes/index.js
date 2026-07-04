const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');
const requireKiosk = require('../middleware/requireKiosk');

// Rutas públicas (sin autenticación)
router.use('/auth', require('./auth.routes'));
router.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// Todo lo siguiente requiere JWT válido
router.use(requireAuth);

// Gestión de usuarios (solo ADMIN — protegido internamente)
router.use('/users', require('./users.routes'));

// Kioskos (listar: cualquier usuario; crear/editar/borrar: solo ADMIN)
router.use('/kiosks', require('./kiosks.routes'));

// Rutas de datos: requieren kiosko activo en cabecera X-Kiosk-Id
router.use('/products',          requireKiosk, require('./products.routes'));
router.use('/categories',        requireKiosk, require('./categories.routes'));
router.use('/purchases',         requireKiosk, require('./purchases.routes'));
router.use('/sales',             requireKiosk, require('./sales.routes'));
router.use('/credits',           requireKiosk, require('./credits.routes'));
router.use('/physical-inventory',requireKiosk, require('./physical.routes'));
router.use('/reports',           requireKiosk, require('./reports.routes'));

module.exports = router;
