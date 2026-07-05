const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const service = require('../services/salesRecord.service');

router.get('/', ah(async (req, res) => res.json(await service.list(req.kioskId))));
router.get('/:id', ah(async (req, res) => res.json(await service.get(req.kioskId, req.params.id))));
router.post('/', validate(schemas.salesRecordCreate), ah(async (req, res) => res.status(201).json(await service.create(req.kioskId, req.body))));
router.put('/:id', validate(schemas.salesRecordCreate), ah(async (req, res) => res.json(await service.update(req.kioskId, req.params.id, req.body))));
router.post('/:id/approve', ah(async (req, res) => res.json(await service.approve(req.kioskId, req.params.id))));
router.delete('/:id', ah(async (req, res) => res.json(await service.remove(req.kioskId, req.params.id))));

module.exports = router;
