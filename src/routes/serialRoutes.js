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
  .post(protect, addSerials);

// Quick ownership verification ("Is this my item?")
router.get('/verify/:serialNumber', protect, verifySerial);

router
  .route('/:id')
  .get(protect, getSerialById)
  .put(protect, updateSerial)
  .delete(protect, authorize('admin'), deleteSerial);

// Sale flow (Credit or Cash / Handover)
router.post('/:id/sell', protect, sellSerial);

// Payment flow for credit sales
router.post('/:id/payments', protect, recordPayment);

module.exports = router;
