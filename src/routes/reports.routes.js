const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const reports = require('../services/report.service');
const ApiError = require('../utils/ApiError');

router.get('/dashboard', ah(async (req, res) => res.json(await reports.dashboard(req.kioskId))));
router.get('/inventory', ah(async (req, res) => res.json(await reports.inventoryControl(req.kioskId))));
router.get('/low-stock', ah(async (req, res) => res.json(await reports.lowStock(req.kioskId))));
router.get('/profit', ah(async (req, res) => res.json(await reports.profit(req.kioskId))));
router.get('/sales-by-day', ah(async (req, res) => res.json(await reports.salesByDay(req.kioskId, req.query))));

router.get('/kardex/:productId', ah(async (req, res) => {
  const data = await reports.kardex(req.kioskId, req.params.productId);
  if (!data) throw new ApiError(404, 'Producto no encontrado.');
  res.json(data);
}));

module.exports = router;
