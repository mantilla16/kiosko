const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const schemas = require('../schemas');
const service = require('../services/sale.service');

// Listar créditos del kiosko activo. ?pending=true => solo con saldo
router.get('/', ah(async (req, res) => {
  res.json(await service.listCredits(req.kioskId, { onlyPending: req.query.pending === 'true' }));
}));

router.get('/customers', ah(async (req, res) => {
  res.json(await service.listCustomers(req.kioskId));
}));

router.get('/customers/:id/history', ah(async (req, res) => {
  res.json(await service.customerHistory(req.kioskId, req.params.id));
}));

router.post('/:saleId/payments', validate(schemas.payment), ah(async (req, res) => {
  const { amount, date } = req.body;
  res.status(201).json(await service.addPayment(req.kioskId, req.params.saleId, amount, date));
}));

module.exports = router;
