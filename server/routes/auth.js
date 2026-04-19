const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { protectUser, protectAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (id, isAdmin = false) => {
  return jwt.sign({ id, isAdmin }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('middleName').optional(),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('address.barangay').notEmpty().withMessage('Barangay is required'),
  body('address.purok').notEmpty().withMessage('Purok is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, middleName, lastName, email, password, phoneNumber, address } = req.body;

    // Check if user already exists (only if email provided)
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }

    // Create user
    const user = await User.create({
      firstName,
      middleName,
      lastName,
      email,
      password,
      phoneNumber,
      address
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          isVerified: user.isVerified
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if it's an admin login
    const admin = await Admin.findOne({ email }).select('+password');
    if (admin) {
      if (admin.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is locked due to multiple failed login attempts. Try again later.'
        });
      }

      const isMatch = await admin.matchPassword(password);
      if (isMatch) {
        await admin.resetLoginAttempts();
        const token = generateToken(admin._id, true);

        return res.json({
          success: true,
          message: 'Admin login successful',
          data: {
            token,
            isAdmin: true,
            admin: {
              id: admin._id,
              firstName: admin.firstName,
              lastName: admin.lastName,
              email: admin.email,
              position: admin.position,
              barangay: admin.barangay,
              permissions: admin.permissions,
              isSuperAdmin: admin.isSuperAdmin
            }
          }
        });
      } else {
        await admin.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
    }

    // Check if it's a user login
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'User login successful',
      data: {
        token,
        isAdmin: false,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          isVerified: user.isVerified,
          profilePicture: user.profilePicture
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          isVerified: user.isVerified,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get current admin profile
// @route   GET /api/auth/admin/me
// @access  Private (Admin)
router.get('/admin/me', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    
    res.json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phoneNumber: admin.phoneNumber,
          position: admin.position,
          barangay: admin.barangay,
          department: admin.department,
          permissions: admin.permissions,
          isSuperAdmin: admin.isSuperAdmin,
          profilePicture: admin.profilePicture,
          resolvedComplaints: admin.resolvedComplaints,
          averageResolutionTime: admin.averageResolutionTime
        }
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
