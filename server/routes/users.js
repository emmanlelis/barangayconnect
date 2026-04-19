const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protectUser } = require('../middleware/auth');

const router = express.Router();

// All user routes require user authentication
router.use(protectUser);

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private (User)
router.put('/profile', [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
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

    const { firstName, lastName, phoneNumber, address } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = { ...user.address, ...address };

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified
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
    
    const userId = req.user._id;

    // Get complaint statistics
    const totalComplaints = await Complaint.countDocuments({ user: userId });
    const pendingComplaints = await Complaint.countDocuments({ user: userId, status: 'Pending' });
    const inProgressComplaints = await Complaint.countDocuments({ user: userId, status: 'In Progress' });
    const resolvedComplaints = await Complaint.countDocuments({ user: userId, status: 'Resolved' });
    const closedComplaints = await Complaint.countDocuments({ user: userId, status: 'Closed' });

    // Get complaints by category
    const complaintsByCategory = await Complaint.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get recent complaints
    const recentComplaints = await Complaint.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title category status priority createdAt progress');

    res.json({
      success: true,
      data: {
        statistics: {
          totalComplaints,
          pendingComplaints,
          inProgressComplaints,
          resolvedComplaints,
          closedComplaints
        },
        complaintsByCategory,
        recentComplaints
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
