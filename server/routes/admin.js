const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticator } = require('otplib');
const Complaint = require('../models/Complaint');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Blotter = require('../models/Blotter');
const { protectAdmin, authorize } = require('../middleware/auth');
const { getMailTransport, getMailSettingsResponse } = require('../services/mailService');
const cloudinary = require('cloudinary').v2;
const {
  createNotification,
  createNotifications,
  getAccountUpdateNotification,
  getReceivedNotification,
  getStatusNotification,
  resolveBlotterRecipients
} = require('../services/notificationService');
const { buildAccountChangeLog } = require('../utils/accountChange');

const router = express.Router();

const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const notDeletedUserFilter = {
  $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
};

// All admin routes require admin authentication
router.use(protectAdmin);

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
router.get('/dashboard', authorize('view_reports', 'admin_panel'), async (req, res) => {
  try {
    // Keep dashboard counters consistent with /api/blotters listing.
    const activeBlotterFilter = { isDeleted: false };

    // Get blotter statistics by status
    const totalComplaints = await Blotter.countDocuments(activeBlotterFilter);
    const newAppBlotters = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'new' });
    const newOngoingBlotters = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'ongoing' });
    const ongoingNoMediation = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'ongoing-no-mediation' });
    const ongoing2ndMediation = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'ongoing-2nd' });
    const ongoing3rdMediation = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'ongoing-3rd' });
    const noShowBlotters = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'no-show' });
    const resolvedBlotters = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'resolved' });
    const certificateAction = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'certificate-action' });
    const luponBlotters = await Blotter.countDocuments({ ...activeBlotterFilter, status: 'lupon' });

    // Debug logging
    console.log('Dashboard Statistics:', {
      totalComplaints,
      newAppBlotters,
      newOngoingBlotters,
      ongoingNoMediation,
      ongoing2ndMediation,
      ongoing3rdMediation,
      noShowBlotters,
      resolvedBlotters,
      certificateAction,
      luponBlotters
    });

    // Get recent blotters
    const recentComplaints = await Blotter.find(activeBlotterFilter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('caseNumber complainant respondent status createdAt createdBy');

    // Get blotters by status for charts
    const blottersByStatus = await Blotter.aggregate([
      {
        $match: activeBlotterFilter
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get monthly blotter trends (last 6 months)
    const monthlyTrends = await Blotter.aggregate([
      {
        $match: {
          ...activeBlotterFilter,
          createdAt: {
            $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) // Last 6 months
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get average resolution time for blotters
    const avgResolutionTime = await Blotter.aggregate([
      {
        $match: {
          ...activeBlotterFilter,
          status: 'resolved',
          resolvedAt: { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$resolutionTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        statistics: {
          totalComplaints,
          newAppBlotters,
          newOngoingBlotters,
          ongoingNoMediation,
          ongoing2ndMediation,
          ongoing3rdMediation,
          noShowBlotters,
          resolvedBlotters,
          certificateAction,
          luponBlotters,
          avgResolutionTime: avgResolutionTime.length > 0 ? avgResolutionTime[0].avgDays : 0
        },
        complaintsByCategory: blottersByStatus,
        complaintsByPriority: [],
        recentComplaints,
        monthlyTrends
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data'
    });
  }
});

// @desc    Get all complaints with filtering and pagination
// @route   GET /api/admin/complaints
// @access  Private (Admin)
router.get('/complaints', authorize('view_complaints'), async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      assignedTo,
      isAnonymous,
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (isAnonymous !== undefined) filter.isAnonymous = isAnonymous === 'true';

    // Search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const complaints = await Complaint.find(filter)
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('assignedTo', 'firstName lastName position')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filter);

    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching complaints'
    });
  }
});

// @desc    Get complaints requiring mediation
// @route   GET /api/admin/complaints/mediation
// @access  Private (Admin)
router.get('/complaints/mediation', authorize('view_complaints'), async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('user', 'firstName lastName email phoneNumber address')
      .populate('defendant', 'firstName lastName email phoneNumber address')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: complaints || []
    });
  } catch (error) {
    console.error('Get mediation complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching mediation complaints'
    });
  }
});

// @desc    Attach defendant to complaint
// @route   PUT /api/admin/complaints/:id/defendant
// @access  Private (Admin)
router.put('/complaints/:id/defendant', [
  body('defendantId').notEmpty().withMessage('Defendant ID is required')
], authorize('manage_complaints'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { defendantId } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Verify defendant exists
    const defendant = await User.findById(defendantId);
    if (!defendant) {
      return res.status(404).json({
        success: false,
        message: 'Defendant not found'
      });
    }

    complaint.defendant = defendantId;
    complaint.requiresMediation = true;
    complaint.mediationStatus = 'pending';
    await complaint.save();

    const linkedBlotter = await Blotter.findOne({
      isDeleted: false,
      sourceComplaint: complaint._id
    });

    if (linkedBlotter) {
      linkedBlotter.defendantUser = defendantId;
      const defendantFullName = `${defendant.firstName || ''} ${defendant.lastName || ''}`.trim();
      if (defendantFullName) {
        linkedBlotter.respondent = defendantFullName;
      }
      await linkedBlotter.save();

      await createNotification({
        recipient: defendantId,
        ...getReceivedNotification(linkedBlotter)
      });
    }

    // Populate after saving
    const updatedComplaint = await Complaint.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('defendant', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Defendant attached successfully',
      data: updatedComplaint
    });
  } catch (error) {
    console.error('Attach defendant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while attaching defendant'
    });
  }
});

// @desc    Schedule mediation
// @route   PUT /api/admin/complaints/:id/mediation
// @access  Private (Admin)
router.put('/complaints/:id/mediation', [
  body('mediationDate').notEmpty().withMessage('Mediation date is required'),
  body('notes').optional()
], authorize('manage_complaints'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { mediationDate, notes } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    complaint.mediationDate = new Date(mediationDate);
    complaint.mediationStatus = 'scheduled';

    if (notes) {
      complaint.mediationNotes.push({
        note: notes,
        addedBy: req.admin._id,
        addedAt: new Date()
      });
    }

    await complaint.save();

    res.json({
      success: true,
      message: 'Mediation scheduled successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Schedule mediation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while scheduling mediation'
    });
  }
});

// @desc    Create new user (Admin creates)
// @route   POST /api/admin/users
// @access  Private (Admin)
router.post('/users', [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('address.barangay').notEmpty().withMessage('Barangay is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.province').notEmpty().withMessage('Province is required'),
  body('address.purok').notEmpty().withMessage('Purok is required'),
], authorize('manage_users'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, middleName, lastName, email, password, phoneNumber, address, profilePicture } = req.body;

    // Check if email already exists (if provided)
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
      address,
      profilePicture: profilePicture || null,
      isVerified: true, // Admin created users are pre-verified
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating user',
      error: error.message
    });
  }
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
router.get('/users', authorize('manage_users'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive, filterType = 'active' } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);
    const normalizedSearch = typeof search === 'string' ? search.trim() : '';
    const normalizedSearchEmail = normalizeEmail(normalizedSearch);

    const andFilters = [];

    if (filterType === 'recently-deleted') {
      andFilters.push({ isDeleted: true });
    } else {
      andFilters.push(notDeletedUserFilter);
    }

    if (isActive !== undefined) {
      andFilters.push({ isActive: isActive === 'true' });
    }

    if (normalizedSearch) {
      const safeSearchRegex = escapeRegex(normalizedSearch);
      andFilters.push({
        $or: [
        { firstName: { $regex: safeSearchRegex, $options: 'i' } },
        { lastName: { $regex: safeSearchRegex, $options: 'i' } },
        { middleName: { $regex: safeSearchRegex, $options: 'i' } },
        { email: { $regex: safeSearchRegex, $options: 'i' } },
        { email: normalizedSearchEmail },
        { phoneNumber: { $regex: safeSearchRegex, $options: 'i' } }
        ]
      });
    }

    const filter = andFilters.length === 1 ? andFilters[0] : { $and: andFilters };

    const skip = (pageNumber - 1) * limitNumber;

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select('-password');

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: pageNumber,
          total: Math.ceil(total / limitNumber),
          count: total,
          hasNext: pageNumber * limitNumber < total,
          hasPrev: pageNumber > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private (Admin)
router.get('/users/stats', authorize('manage_users'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments(notDeletedUserFilter);
    const activeUsers = await User.countDocuments({ ...notDeletedUserFilter, isActive: true });
    const inactiveUsers = await User.countDocuments({ ...notDeletedUserFilter, isActive: false });
    const deletedUsers = await User.countDocuments({ isDeleted: true });
    const newUsersThisMonth = await User.countDocuments({
      ...notDeletedUserFilter,
      createdAt: {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        newUsersThisMonth,
        deletedUsers,
        newUsers30Days: newUsersThisMonth
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

// @desc    Get all admins
// @route   GET /api/admin/admins
// @access  Private (Super Admin)
router.get('/admins', authorize('admin_panel'), async (req, res) => {
  try {
    const admins = await Admin.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { admins }
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admins'
    });
  }
});

// @desc    Create new admin
// @route   POST /api/admin/admins
// @access  Private (Super Admin)
router.post('/admins', [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('position').isIn(['Barangay Captain', 'Barangay Councilor', 'Barangay Secretary', 'Barangay Treasurer', 'Barangay Administrator', 'Staff']).withMessage('Invalid position'),
  body('barangay').notEmpty().withMessage('Barangay is required')
], authorize('admin_panel'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password, phoneNumber, position, barangay, department, permissions } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Create admin
    const admin = await Admin.create({
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      position,
      barangay,
      department,
      permissions: permissions || ['view_complaints']
    });

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          position: admin.position,
          barangay: admin.barangay,
          department: admin.department,
          permissions: admin.permissions,
          isActive: admin.isActive
        }
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating admin'
    });
  }
});

// @desc    Update user details
// @route   PUT /api/admin/users/:id
// @access  Private (Admin)
router.put('/users/:id', [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('middleName').optional(),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('address').optional().isObject().withMessage('Address must be an object'),
  body('profilePicture').optional()
], authorize('manage_users'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, middleName, lastName, email, password, phoneNumber, address, profilePicture } = req.body;
    
    const user = await User.findById(req.params.id);
    
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
    if (firstName !== undefined) user.firstName = firstName;
    if (middleName !== undefined) user.middleName = middleName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = normalizedEmail;
    if (password) user.password = password;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (profilePicture !== undefined) user.profilePicture = profilePicture || null;
    if (address) {
      user.address = {
        ...user.address,
        ...address
      };
    }

    const changeLog = buildAccountChangeLog({
      beforeUser,
      afterUser: user.toObject(),
      actorType: 'admin',
      actorId: req.admin._id,
      source: 'web-admin'
    });

    if (changeLog) {
      user.accountChanges = [changeLog, ...(user.accountChanges || [])].slice(0, 20);
    }

    await user.save();

    await createNotification({
      recipient: user._id,
      ...getAccountUpdateNotification('profile_updated'),
      metadata: {
        updatedBy: req.admin?._id || null,
        source: 'web-admin',
        changedFields: changeLog?.changedFields || Object.keys(req.body || {}).filter((field) => field !== 'password')
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
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
          isActive: user.isActive,
          isVerified: user.isVerified,
          accountChanges: user.accountChanges || []
        }
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
});

// @desc    Reset user password directly by admin
// @route   PUT /api/admin/users/:id/reset-password
// @access  Private (Admin)
router.put('/users/:id/reset-password', [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Authenticator code must be 6 digits')
], authorize('manage_users'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { password, otp } = req.body;
    const adminWithSecret = await Admin.findById(req.admin._id).select('+authenticatorSecret');

    if (!adminWithSecret) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found'
      });
    }

    if (!adminWithSecret.authenticatorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Authenticator is not set up for this admin account'
      });
    }

    const otpValid = authenticator.check(String(otp || '').trim(), adminWithSecret.authenticatorSecret);
    if (!otpValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authenticator code'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reset password for a deleted user'
      });
    }

    user.password = password;

    await user.save();

    await createNotification({
      recipient: user._id,
      ...getAccountUpdateNotification('profile_updated'),
      metadata: {
        updatedBy: req.admin?._id || null,
        source: 'web-admin-password-reset',
        changedFields: ['password']
      }
    });

    res.json({
      success: true,
      message: 'User password reset successfully'
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting user password'
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
router.delete('/users/:id', authorize('manage_users'), async (req, res) => {
  try {
    const user = await User.findOne({
      $and: [
        { _id: req.params.id },
        notDeletedUserFilter
      ]
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.admin ? req.admin._id : undefined;
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'User moved to Recently Deleted',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
});

// @desc    Recover soft-deleted user
// @route   PUT /api/admin/users/:id/recover
// @access  Private (Admin)
router.put('/users/:id/recover', authorize('manage_users'), async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, isDeleted: true });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Deleted user not found'
      });
    }

    user.isDeleted = false;
    user.deletedAt = undefined;
    user.deletedBy = undefined;
    user.isActive = true;
    await user.save();

    res.json({
      success: true,
      message: 'User recovered successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
          isDeleted: user.isDeleted
        }
      }
    });
  } catch (error) {
    console.error('Recover user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while recovering user'
    });
  }
});

// @desc    Permanently delete a soft-deleted user (hard delete)
// @route   POST /api/admin/users/:id/permanent-delete
// @access  Private (Admin)
router.post('/users/:id/permanent-delete', authorize('manage_users'), async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Admin password is required for permanent deletion' });
    }

    // Re-fetch admin with password for verification
    const AdminModel = require('../models/Admin');
    const adminWithPassword = await AdminModel.findById(req.admin._id).select('+password');

    if (!adminWithPassword) {
      return res.status(401).json({ success: false, message: 'Admin authentication failed' });
    }

    const isMatch = await adminWithPassword.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect admin password' });
    }

    // Ensure target user exists and is soft-deleted
    const user = await User.findOne({ _id: req.params.id, isDeleted: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Deleted user not found' });
    }

    await User.deleteOne({ _id: user._id });

    res.json({ success: true, message: 'User permanently deleted' });
  } catch (error) {
    console.error('Permanent delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error while permanently deleting user' });
  }
});

// @desc    Update user status (activate/deactivate)
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
router.put('/users/:id/status', [
  body('isActive').isBoolean().withMessage('isActive must be boolean')
], authorize('manage_users'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user: {
          id: user._id,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user status'
    });
  }
});

// @desc    Get performance metrics
// @route   GET /api/admin/performance
// @access  Private (Admin)
router.get('/performance', authorize('view_reports'), async (req, res) => {
  try {
    // Get admin performance metrics
    const adminPerformance = await Admin.aggregate([
      {
        $lookup: {
          from: 'complaints',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'assignedComplaints'
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          position: 1,
          barangay: 1,
          assignedCount: { $size: '$assignedComplaints' },
          resolvedCount: {
            $size: {
              $filter: {
                input: '$assignedComplaints',
                cond: { $eq: ['$$this.status', 'Resolved'] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          resolutionRate: {
            $cond: [
              { $eq: ['$assignedCount', 0] },
              0,
              { $multiply: [{ $divide: ['$resolvedCount', '$assignedCount'] }, 100] }
            ]
          }
        }
      },
      {
        $sort: { resolvedCount: -1 }
      }
    ]);

    res.json({
      success: true,
      data: { adminPerformance }
    });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching performance metrics'
    });
  }
});

// @desc    Create a manual blotter
// @route   POST /api/admin/blotters
// @access  Private (Admin)
router.post('/blotters', [
  body('title').optional().trim(),
  body('caseTitle').optional().trim(),
  body('blotterTitle').optional().trim(),
  body('description').optional().trim(),
  body('blotterDescription').optional().trim(),
  body('location').optional().trim(),
  body('reportedBy').optional().trim(),
  body('plaintiffName').optional().trim(),
  body('complainantName').optional().trim(),
  body('defendantName').optional().trim()
], authorize('manage_complaints'), async (req, res) => {
  try {
    const validationErrors = [];
    const { title, description, location, reportedBy, defendantName, category, priority, mediationRequired, mediationNotes, mediationDate, mediationTime, defendant, defendantId, complainantId, complainantUser, incidentDate, subpoenaEnabled, subpoenaSubject, subpoenaBody, complainantEmail, defendantEmail, sendSubpoenaEmail, attachments } = req.body;

    const normalizedTitle = (title || req.body.caseTitle || req.body.blotterTitle || '').trim();
    const normalizedDescription = (description || req.body.blotterDescription || '').trim();
    const normalizedLocation = (location || req.body.incidentLocation || '').trim();
    const normalizedReportedBy = (reportedBy || req.body.plaintiffName || req.body.complainantName || '').trim();
    const normalizedDefendantName = (defendantName || '').trim();

    if (!normalizedTitle) validationErrors.push({ msg: 'Blotter title is required' });
    if (!normalizedDescription) validationErrors.push({ msg: 'Description is required' });
    if (!normalizedLocation) validationErrors.push({ msg: 'Location is required' });
    if (!normalizedReportedBy) validationErrors.push({ msg: 'Plaintiff name is required' });
    if (!normalizedDefendantName) validationErrors.push({ msg: 'Defendant name is required' });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const cleanComplainantEmail = normalizeEmail(complainantEmail);
    const cleanDefendantEmail = normalizeEmail(defendantEmail);
    const selectedComplainantId = complainantId || complainantUser || null;
    let selectedComplainant = null;
    const selectedDefendantId = defendantId || defendant || null;
    let selectedDefendant = null;

    if (selectedComplainantId) {
      selectedComplainant = await User.findOne({
        _id: selectedComplainantId,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
      }).select('firstName middleName lastName email phoneNumber address');

      if (!selectedComplainant) {
        return res.status(404).json({
          success: false,
          message: 'Complainant account not found'
        });
      }
    }

    if (selectedDefendantId) {
      selectedDefendant = await User.findOne({
        _id: selectedDefendantId,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
      }).select('firstName middleName lastName email phoneNumber address');

      if (!selectedDefendant) {
        return res.status(404).json({
          success: false,
          message: 'Defendant account not found'
        });
      }
    }

    // Generate case number (e.g., BL-2026-001)
    const year = new Date().getFullYear();
    const lastBlotter = await Blotter.findOne().sort({ createdAt: -1 });
    let caseNumber = `BL-${year}-001`;
    
    if (lastBlotter) {
      const lastCaseNum = lastBlotter.caseNumber;
      const parts = lastCaseNum.split('-');
      if (parts[1] == year) {
        const nextNum = parseInt(parts[2]) + 1;
        caseNumber = `BL-${year}-${String(nextNum).padStart(3, '0')}`;
      }
    }

    // Create blotter record
    const blotterData = {
      caseNumber,
      complainant: selectedComplainant
        ? `${selectedComplainant.firstName || ''} ${selectedComplainant.lastName || ''}`.trim() || normalizedReportedBy
        : normalizedReportedBy,
      respondent: selectedDefendant
        ? `${selectedDefendant.firstName || ''} ${selectedDefendant.lastName || ''}`.trim() || normalizedDefendantName
        : normalizedDefendantName,
      description: normalizedDescription,
      location: normalizedLocation,
      status: mediationRequired === 'no' ? 'ongoing-no-mediation' : 'ongoing',
      caseType: 'regular',
      notes: mediationNotes || '',
      dateOfMeeting: mediationDate ? new Date(mediationDate) : undefined,
      createdBy: req.admin._id
    };

    if (selectedComplainant) {
      blotterData.complainantUser = selectedComplainant._id;
    }

    if (selectedDefendant) {
      blotterData.defendantUser = selectedDefendant._id;
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      blotterData.attachments = attachments
        .filter((item) => {
          const attachmentUrl = item?.url || item?.secure_url || item?.secureUrl || item?.path;
          return !!attachmentUrl;
        })
        .map((item) => {
          const attachmentUrl = item?.url || item?.secure_url || item?.secureUrl || item?.path;
          const resourceType = item?.resourceType || item?.resource_type;

          return {
            filename: item.filename || item.originalName || item.originalname || 'attachment',
            url: attachmentUrl,
            resourceType: resourceType === 'video' ? 'video' : 'image',
            format: item.format,
            size: item.size || item.bytes,
            uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : new Date()
          };
        });
    }

    if (subpoenaEnabled) {
      blotterData.subpoena = {
        subject: subpoenaSubject || '',
        body: subpoenaBody || '',
        complainantEmail: cleanComplainantEmail || undefined,
        defendantEmail: cleanDefendantEmail || selectedDefendant?.email || undefined
      };
    }

    const blotter = await Blotter.create(blotterData);

    if (selectedDefendant) {
      await createNotification({
        recipient: selectedDefendant._id,
        ...getReceivedNotification(blotter)
      });
    }

    if (selectedComplainant) {
      await createNotification({
        recipient: selectedComplainant._id,
        ...getReceivedNotification(blotter)
      });
    }

    let subpoenaEmailResult = null;
    if (subpoenaEnabled && sendSubpoenaEmail) {
      const recipients = [cleanComplainantEmail, cleanDefendantEmail].filter(Boolean);

      if (recipients.length === 0) {
        subpoenaEmailResult = {
          success: false,
          message: 'No recipient email addresses provided for subpoena sending.'
        };
      } else {
        const transport = await getMailTransport();
        if (!transport) {
          subpoenaEmailResult = {
            success: false,
            message: 'SMTP is not configured. Please configure mail settings in the admin panel or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL in server/.env.'
          };
        } else {
          const mailSettings = await getMailSettingsResponse();
          try {
            await transport.sendMail({
              from: mailSettings.fromEmail || mailSettings.user,
              to: recipients.join(', '),
              subject: subpoenaSubject || `Subpoena Notice - ${caseNumber}`,
              text: subpoenaBody || 'Please see subpoena details from BarangayConnect admin.',
              html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${(subpoenaBody || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
            });

            // Store generated subpoena document as an attachment (upload HTML as raw document)
            try {
              const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><title>Subpoena - ${caseNumber}</title></head><body>${(subpoenaBody || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</body></html>`;
              
              const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                  {
                    resource_type: 'raw',
                    folder: 'barangay-connect/documents',
                    public_id: `${caseNumber}_subpoena_${Date.now()}`,
                    format: 'html'
                  },
                  (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                  }
                );
                uploadStream.end(Buffer.from(htmlDoc, 'utf-8'));
              });

              if (uploadResult && uploadResult.secure_url) {
                blotter.attachments = Array.isArray(blotter.attachments) ? blotter.attachments : [];
                blotter.attachments.push({
                  filename: `${caseNumber}_subpoena.html`,
                  url: uploadResult.secure_url,
                  resourceType: 'document',
                  format: uploadResult.format || 'html',
                  size: uploadResult.bytes || uploadResult.size || 0,
                  uploadedAt: new Date()
                });
                blotter.generatedDocuments = Array.isArray(blotter.generatedDocuments) ? blotter.generatedDocuments : [];
                blotter.generatedDocuments.push({
                  filename: `${caseNumber}_subpoena.html`,
                  url: uploadResult.secure_url,
                  resourceType: 'document',
                  documentType: 'subpoena',
                  subject: subpoenaSubject || `Subpoena Notice - ${caseNumber}`,
                  body: subpoenaBody || '',
                  sentTo: recipients,
                  format: uploadResult.format || 'html',
                  size: uploadResult.bytes || uploadResult.size || 0,
                  uploadedAt: new Date()
                });
                await blotter.save();
              }
            } catch (uploadErr) {
              console.error('Failed to upload subpoena document to Cloudinary:', uploadErr);
            }

            blotter.subpoena = {
              ...(blotter.subpoena || {}),
              sentAt: new Date(),
              sentTo: recipients,
              sendError: undefined
            };
            await blotter.save();

            subpoenaEmailResult = {
              success: true,
              recipients
            };
          } catch (mailError) {
            blotter.subpoena = {
              ...(blotter.subpoena || {}),
              sendError: mailError.message
            };
            await blotter.save();

            subpoenaEmailResult = {
              success: false,
              message: mailError.message
            };
          }
        }
      }
    }

    // Note: Complaint records are created separately through the complaint submission flow
    // Manual blotters are stored in the Blotter collection and can be linked to complaints later
    // This simplifies the process and avoids data consistency issues

    await blotter.populate('createdBy', 'firstName lastName');
    await blotter.populate('defendantUser', 'firstName middleName lastName email phoneNumber address');

    res.status(201).json({
      success: true,
      message: 'Manual blotter created successfully',
      data: {
        blotter,
        caseNumber: blotter.caseNumber,
        subpoenaEmailResult
      }
    });
  } catch (error) {
    console.error('Create manual blotter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating blotter',
      error: error.message
    });
  }
});

// @desc    Get mail settings
// @route   GET /api/admin/mail-settings
// @access  Private (Admin)
router.get('/mail-settings', async (req, res) => {
  try {
    const settings = await getMailSettingsResponse();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get mail settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving mail settings',
      error: error.message
    });
  }
});

// @desc    Save mail settings
// @route   POST /api/admin/mail-settings
// @access  Private (Admin)
router.post('/mail-settings', 
  authorize('admin'),
  [
    body('smtpHost').optional().trim().notEmpty(),
    body('smtpPort').optional().isInt({ min: 1, max: 65535 }),
    body('smtpSecure').optional().isBoolean(),
    body('smtpUser').optional().trim(),
    body('smtpPass').optional(),
    body('smtpFromEmail').optional().trim(),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors.array()
        });
      }

      const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromEmail, isActive } = req.body;
      
      const result = await saveMailSettings({
        smtpHost,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpSecure,
        smtpUser,
        smtpPass,
        smtpFromEmail,
        isActive,
        updatedBy: req.admin._id
      });

      res.json(result);
    } catch (error) {
      console.error('Save mail settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving mail settings',
        error: error.message
      });
    }
  }
);

// @desc    Test mail settings
// @route   POST /api/admin/mail-settings/test
// @access  Private (Admin)
router.post('/mail-settings/test',
  authorize('admin'),
  [
    body('smtpHost').optional().trim().notEmpty(),
    body('smtpPort').optional().isInt({ min: 1, max: 65535 }),
    body('smtpSecure').optional().isBoolean(),
    body('smtpUser').optional().trim(),
    body('smtpPass').optional(),
    body('smtpFromEmail').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors.array()
        });
      }

      const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromEmail } = req.body;
      
      const result = await testMailSettings({
        smtpHost,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpSecure,
        smtpUser,
        smtpPass,
        smtpFromEmail
      });

      res.json(result);
    } catch (error) {
      console.error('Test mail settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Error testing mail settings',
        error: error.message
      });
    }
  }
);

module.exports = router;
