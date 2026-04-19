const express = require('express');
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const { protectUser, protectAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @desc    Submit a new complaint
// @route   POST /api/complaints
// @access  Private (User) or Public (for anonymous)
router.post('/', [
  body('title').notEmpty().withMessage('Complaint title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('category').isIn([
    'Infrastructure',
    'Service Quality',
    'Safety',
    'Environmental',
    'Environmental Issues',
    'Health',
    'Health Services',
    'Education',
    'Public Safety',
    'Traffic Management',
    'Waste Management',
    'Noise Pollution',
    'Others'
  ]).withMessage('Invalid category'),
  body('priority').isIn(['Low', 'Medium', 'High', 'Urgent']).withMessage('Invalid priority'),
  body('location').notEmpty().withMessage('Location is required'),
  body('isAnonymous').exists().withMessage('isAnonymous is required').toBoolean().isBoolean().withMessage('isAnonymous must be boolean')
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

    const { title, description, category, priority, location, coordinates, isAnonymous, anonymousContact, images } = req.body;

    let complaintData = {
      title,
      description,
      category,
      priority,
      location,
      coordinates,
      isAnonymous,
      images: images || []
    };

    // Handle user vs anonymous submission
    if (isAnonymous) {
      if (!anonymousContact) {
        return res.status(400).json({
          success: false,
          message: 'Anonymous contact information is required for anonymous complaints'
        });
      }
      complaintData.anonymousContact = anonymousContact;
      complaintData.user = null; // Will be set to a system user ID
    } else {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required for non-anonymous complaints'
        });
      }
      complaintData.user = req.user._id;
    }

    // Create complaint
    const complaint = await Complaint.create(complaintData);

    // Populate user info for response
    await complaint.populate('user', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: {
        complaint: {
          id: complaint._id,
          title: complaint.title,
          description: complaint.description,
          category: complaint.category,
          priority: complaint.priority,
          status: complaint.status,
          progress: complaint.progress,
          location: complaint.location,
          isAnonymous: complaint.isAnonymous,
          images: complaint.images,
          createdAt: complaint.createdAt,
          user: complaint.isAnonymous ? null : {
            firstName: complaint.user.firstName,
            lastName: complaint.user.lastName
          }
        }
      }
    });
  } catch (error) {
    console.error('Submit complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting complaint'
    });
  }
});

// @desc    Get all complaints for a user
// @route   GET /api/complaints/my
// @access  Private (User)
router.get('/my', protectUser, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = { user: req.user._id };
    
    if (status) {
      filter.status = status;
    }
    
    if (category) {
      filter.category = category;
    }

    const skip = (page - 1) * limit;

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-adminNotes -statusHistory');

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
    console.error('Get user complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching complaints'
    });
  }
});

// @desc    Get single complaint details
// @route   GET /api/complaints/:id
// @access  Private (User) or Private (Admin)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('assignedTo', 'firstName lastName position')
      .populate('adminNotes.addedBy', 'firstName lastName position')
      .populate('statusHistory.changedBy', 'firstName lastName position');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check access permissions
    if (complaint.isAnonymous) {
      // Anonymous complaints can be viewed by admins and the anonymous submitter
      if (!req.admin && (!req.user || req.user._id.toString() !== complaint.user?.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else {
      // Non-anonymous complaints can be viewed by the user who submitted it and admins
      if (!req.admin && (!req.user || req.user._id.toString() !== complaint.user._id.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: {
        complaint
      }
    });
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching complaint'
    });
  }
});

// @desc    Update complaint status (Admin only)
// @route   PUT /api/complaints/:id/status
// @access  Private (Admin)
router.put('/:id/status', [
  body('status').isIn(['Pending', 'In Progress', 'Under Review', 'Resolved', 'Closed', 'Rejected']).withMessage('Invalid status'),
  body('note').optional().isString().withMessage('Note must be a string')
], protectAdmin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status, note } = req.body;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Add status change to history
    await complaint.addStatusChange(status, req.admin._id, note);

    res.json({
      success: true,
      message: 'Complaint status updated successfully',
      data: {
        complaint: {
          id: complaint._id,
          status: complaint.status,
          progress: complaint.progress,
          actualResolutionDate: complaint.actualResolutionDate
        }
      }
    });
  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating complaint status'
    });
  }
});

// @desc    Add admin note to complaint
// @route   POST /api/complaints/:id/notes
// @access  Private (Admin)
router.post('/:id/notes', [
  body('note').notEmpty().withMessage('Note content is required')
], protectAdmin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { note, attachments } = req.body;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Add admin note
    await complaint.addAdminNote(note, req.admin._id, attachments || []);

    res.status(201).json({
      success: true,
      message: 'Admin note added successfully',
      data: {
        note: complaint.adminNotes[complaint.adminNotes.length - 1]
      }
    });
  } catch (error) {
    console.error('Add admin note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding admin note'
    });
  }
});

// @desc    Assign complaint to admin
// @route   PUT /api/complaints/:id/assign
// @access  Private (Admin)
router.put('/:id/assign', [
  body('assignedTo').isMongoId().withMessage('Valid admin ID is required')
], protectAdmin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { assignedTo } = req.body;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    complaint.assignedTo = assignedTo;
    complaint.assignedAt = new Date();
    
    await complaint.save();

    res.json({
      success: true,
      message: 'Complaint assigned successfully',
      data: {
        complaint: {
          id: complaint._id,
          assignedTo: complaint.assignedTo,
          assignedAt: complaint.assignedAt
        }
      }
    });
  } catch (error) {
    console.error('Assign complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while assigning complaint'
    });
  }
});

// @desc    Submit user feedback for resolved complaint
// @route   POST /api/complaints/:id/feedback
// @access  Private (User)
router.post('/:id/feedback', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isString().withMessage('Comment must be a string')
], protectUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { rating, comment } = req.body;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check if user owns this complaint
    if (complaint.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if complaint is resolved
    if (complaint.status !== 'Resolved') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted for resolved complaints'
      });
    }

    complaint.userFeedback = {
      rating,
      comment,
      submittedAt: new Date()
    };

    await complaint.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedback: complaint.userFeedback
      }
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback'
    });
  }
});

module.exports = router;
