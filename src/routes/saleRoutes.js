const express = require('express');
const router = express.Router();
const {
  createSale,
  getSales,
  recordSalePayment
} = require('../controllers/saleController');
const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, authorize('admin', 'sales', 'staff'), getSales)
  .post(protect, authorize('admin', 'sales', 'staff'), createSale);

router.post('/:id/payments', protect, authorize('admin', 'sales', 'staff'), recordSalePayment);

module.exports = router;
