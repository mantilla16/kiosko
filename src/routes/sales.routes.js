const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const service = require('../services/sale.service');

router.get('/', ah(async (req, res) => res.json(await service.list(req.kioskId, req.query))));
router.post('/', validate(schemas.saleCreate), ah(async (req, res) => res.status(201).json(await service.create(req.kioskId, req.body))));

module.exports = router;
