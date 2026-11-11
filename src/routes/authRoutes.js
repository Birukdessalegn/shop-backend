const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  getUsers,
  seedAdmin
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/seed-admin', seedAdmin);
router.get('/me', protect, getMe);
router.get('/users', protect, authorize('admin'), getUsers);

module.exports = router;

