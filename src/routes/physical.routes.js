const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const service = require('../services/physical.service');
const ApiError = require('../utils/ApiError');

router.get('/', ah(async (req, res) => res.json(await service.list(req.kioskId))));

router.get('/:id', ah(async (req, res) => {
  const inv = await service.get(req.kioskId, req.params.id);
  if (!inv) throw new ApiError(404, 'Inventario físico no encontrado.');
  res.json(inv);
}));

router.post('/', ah(async (req, res) => res.status(201).json(await service.create(req.kioskId, req.body))));
router.post('/:id/approve', ah(async (req, res) => res.json(await service.approve(req.kioskId, req.params.id))));

module.exports = router;
