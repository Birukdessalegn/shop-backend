const express = require('express');
const router = express.Router();
const {
  getSerials,
  getSerialById,
  addSerials,
  sellSerial,
  recordPayment,
  updateSerial,
  deleteSerial,
  verifySerial
} = require('../controllers/serialController');
const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(protect, getSerials)
  .post(protect, authorize('admin', 'stock', 'staff'), addSerials);

// Quick ownership verification ("Is this my item?")
router.get('/verify/:serialNumber', protect, verifySerial);

router
  .route('/:id')
  .get(protect, getSerialById)
  .put(protect, authorize('admin', 'stock', 'staff'), updateSerial)
  .delete(protect, authorize('admin'), deleteSerial);

// Sale flow (Credit or Cash / Handover)
router.post('/:id/sell', protect, authorize('admin', 'sales', 'staff'), sellSerial);

// Payment flow for credit sales
router.post('/:id/payments', protect, authorize('admin', 'sales', 'staff'), recordPayment);

module.exports = router;
