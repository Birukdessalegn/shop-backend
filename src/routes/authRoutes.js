const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  seedAdmin
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/seed-admin', seedAdmin);
router.get('/me', protect, getMe);

// User Management (Admin only)
router
  .route('/users')
  .get(protect, authorize('admin'), getUsers)
  .post(protect, authorize('admin'), createUser);

router
  .route('/users/:id')
  .put(protect, authorize('admin'), updateUser)
  .delete(protect, authorize('admin'), deleteUser);

module.exports = router;

