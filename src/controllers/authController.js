const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'supersecret_jwt_key_electronics_shop_2026_xyz987',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

// @desc    Register a new user (admin can create staff, or initial setup)
// @route   POST /api/auth/register
// @access  Public (if first user) or Admin
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const userCount = await User.count();
    // If users already exist, only authenticated admin can register new users
    if (userCount > 0) {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can register new staff accounts'
        });
      }
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists'
      });
    }

    // First user is automatically admin
    const assignedRole = userCount === 0 ? 'admin' : (role || 'staff');

    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole
    });

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List all staff/users
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Seed initial admin if no users exist
// @route   POST /api/auth/seed-admin
// @access  Public
exports.seedAdmin = async (req, res, next) => {
  try {
    const count = await User.count();
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Database already has users. Admin seeding is disabled.'
      });
    }

    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@shop.com',
      password: 'adminpassword123',
      role: 'admin'
    });

    const token = generateToken(admin.id);

    res.status(201).json({
      success: true,
      message: 'Default admin account created successfully',
      data: {
        id: admin.id,
        _id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        token,
        credentials: {
          email: 'admin@shop.com',
          password: 'adminpassword123'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
