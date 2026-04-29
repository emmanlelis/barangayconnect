const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protectUser } = require('../middleware/auth');
const {
  createNotification,
  getAccountUpdateNotification
} = require('../services/notificationService');
const { buildAccountChangeLog } = require('../utils/accountChange');

const router = express.Router();

// All user routes require user authentication
router.use(protectUser);

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private (User)
router.put('/profile', [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('middleName').optional(),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phoneNumber').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('address').optional().isObject().withMessage('Address must be an object')
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

    const { firstName, middleName, lastName, email, phoneNumber, address, profilePicture } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : email;

    if (normalizedEmail && normalizedEmail !== user.email) {
      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Another user with this email already exists'
        });
      }
    }

    const beforeUser = user.toObject();

    // Update fields
    if (firstName) user.firstName = firstName;
    if (middleName !== undefined) user.middleName = middleName;
    if (lastName) user.lastName = lastName;
    if (email !== undefined) user.email = normalizedEmail;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = { ...user.address, ...address };
    if (profilePicture !== undefined) user.profilePicture = profilePicture || null;

    const changeLog = buildAccountChangeLog({
      beforeUser,
      afterUser: user.toObject(),
      actorType: 'user',
      actorId: req.user._id,
      source: 'mobile'
    });

    if (changeLog) {
      user.accountChanges = [changeLog, ...(user.accountChanges || [])].slice(0, 20);
    }

    await user.save();

    await createNotification({
      recipient: user._id,
      ...getAccountUpdateNotification('profile_updated'),
      metadata: {
        changedFields: Object.keys(req.body || {})
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified,
          accountChanges: user.accountChanges || []
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
});

// @desc    Change password
// @route   PUT /api/users/password
// @access  Private (User)
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    await createNotification({
      recipient: user._id,
      ...getAccountUpdateNotification('password_changed')
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
});

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (User)
router.get('/stats', async (req, res) => {
  try {
    const Complaint = require('../models/Complaint');
    const Blotter = require('../models/Blotter');
    
    const userId = req.user._id;

    const [
      totalComplaints,
      pendingComplaints,
      inProgressComplaints,
      resolvedComplaints,
      closedComplaints,
      unreadNotifications,
      receivedBlotters,
      manualBlotters,
      luponBlotters,
      pendingBlotters,
      inProgressBlotters,
      closedResolvedBlotters,
      closedNoShowBlotters
    ] = await Promise.all([
      Complaint.countDocuments({ user: userId }),
      Complaint.countDocuments({ user: userId, status: 'Pending' }),
      Complaint.countDocuments({ user: userId, status: { $in: ['In Progress', 'Under Review'] } }),
      Complaint.countDocuments({ user: userId, status: { $in: ['Resolved', 'Closed'] } }),
      Complaint.countDocuments({ user: userId, status: { $in: ['Closed', 'Rejected'] } }),
      Notification.countDocuments({ recipient: userId, isRead: false }),
      Blotter.countDocuments({ isDeleted: false, defendantUser: userId }),
      Blotter.countDocuments({ isDeleted: false, complainantUser: userId }),
      Blotter.countDocuments({ isDeleted: false, defendantUser: userId, status: 'lupon' }),
      Blotter.countDocuments({ isDeleted: false, complainantUser: userId, status: { $in: ['new'] } }),
      Blotter.countDocuments({ isDeleted: false, complainantUser: userId, status: { $in: ['ongoing', 'ongoing-no-mediation', 'ongoing-2nd', 'ongoing-3rd', 'lupon'] } }),
      Blotter.countDocuments({ isDeleted: false, complainantUser: userId, status: { $in: ['resolved'] } }),
      Blotter.countDocuments({ isDeleted: false, complainantUser: userId, status: { $in: ['no-show', 'certificate-action'] } })
    ]);

    const totalAppBlotters = totalComplaints + manualBlotters;

    res.json({
      success: true,
      data: {
        statistics: {
          totalComplaints,
          pendingComplaints,
          inProgressComplaints,
          resolvedComplaints,
          closedComplaints,
          totalBlotters: totalAppBlotters,
          pendingBlotters,
          inProgressBlotters,
          closedResolvedBlotters,
          closedNoShowBlotters,
          receivedBlotters,
          manualBlotters,
          luponBlotters,
          unreadNotifications
        },
        complaintsByCategory: [],
        recentComplaints: []
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user statistics'
    });
  }
});

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private (User)
router.delete('/account', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete by deactivating account
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting account'
    });
  }
});

module.exports = router;
