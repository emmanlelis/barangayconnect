const express = require('express');
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const Blotter = require('../models/Blotter');
const { protectUser, protectAdmin, optionalAuth } = require('../middleware/auth');
const {
  createNotification,
  getSubmissionNotification,
  getStatusNotification
} = require('../services/notificationService');

const router = express.Router();

// @desc    Submit a new complaint
// @route   POST /api/complaints
// @access  Private (User) or Public (for anonymous)
router.post('/', optionalAuth, [
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

    const { title, description, category, priority, location, coordinates, isAnonymous, anonymousContact, images, isFilingComplaintAgainstSomeone, respondentName, respondentRelationship, respondentAddress } = req.body;

    let complaintData = {
      title,
      description,
      category,
      priority,
      location,
      coordinates,
      isAnonymous,
      isFilingComplaintAgainstSomeone: isFilingComplaintAgainstSomeone === true || isFilingComplaintAgainstSomeone === 'true',
      respondentName: respondentName || '',
      respondentRelationship: respondentRelationship || '',
      respondentAddress: respondentAddress || '',
      images: images || []
    };

    let createdBlotter = null;

    // Handle user vs anonymous submission
    if (isAnonymous) {
      complaintData.anonymousContact = anonymousContact || '';
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

    // Mirror mobile submissions into Blotter collection so they appear in Web Admin's
    // "New App Blotters" bucket (status: "new").
    try {
      const year = new Date().getFullYear();
      const lastBlotter = await Blotter.findOne().sort({ createdAt: -1 });
      let caseNumber = `BL-${year}-001`;

      if (lastBlotter?.caseNumber) {
        const parts = lastBlotter.caseNumber.split('-');
        const lastYear = parseInt(parts[1], 10);
        const lastNum = parseInt(parts[2], 10);

        if (lastYear === year && !Number.isNaN(lastNum)) {
          caseNumber = `BL-${year}-${String(lastNum + 1).padStart(3, '0')}`;
        }
      }

      const complainantName = isAnonymous
        ? 'Anonymous App User'
        : `${req.user.firstName} ${req.user.lastName}`.trim();

      // Use questionnaire respondent name if provided, otherwise default to Unspecified
      const blotterRespondentName = respondentName || 'Unspecified Respondent';

      createdBlotter = await Blotter.create({
        caseNumber,
        complainant: complainantName,
        complainantUser: req.user?._id || null, // Track submitter for both anonymous and non-anonymous
        respondent: blotterRespondentName,
        description: `${title}\n\n${description}`,
        location,
        status: 'new',
        caseType: 'regular',
        isAnonymous: isAnonymous,
        priority: priority || 'Medium',
        sourceComplaint: complaint._id,
        isFilingComplaintAgainstSomeone: isFilingComplaintAgainstSomeone === true || isFilingComplaintAgainstSomeone === 'true',
        respondentName: respondentName || '',
        respondentRelationship: respondentRelationship || '',
        respondentAddress: respondentAddress || '',
        notes: isAnonymous
          ? `Source: Mobile App (Anonymous). Contact: ${anonymousContact || 'N/A'}`
          : `Source: Mobile App. Complaint ID: ${complaint._id}`,
      });

      if (!isAnonymous && req.user?._id) {
        await createNotification({
          recipient: req.user._id,
          ...getSubmissionNotification({ ...complaint.toObject(), caseNumber })
        });
      }
    } catch (blotterError) {
      // Do not fail complaint submission if blotter mirroring has an issue.
      console.error('Mirror to blotter error:', blotterError);
    }

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
          },
          blotter: createdBlotter
            ? {
                id: createdBlotter._id,
                caseNumber: createdBlotter.caseNumber,
                status: createdBlotter.status
              }
            : null
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
    
    if (category) {
      filter.category = category;
    }

    const skip = (page - 1) * limit;

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-adminNotes -statusHistory');

    const manualBlottersForUser = await Blotter.find({
      isDeleted: false,
      complainantUser: req.user._id
    })
      .populate('defendantUser', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const mapBlotterStatusToAppStatus = (blotterStatus, defaultStatus) => {
      const statusMap = {
        new: 'Pending',
        ongoing: 'In Progress',
        'ongoing-no-mediation': 'In Progress',
        'ongoing-2nd': 'In Progress',
        'ongoing-3rd': 'In Progress',
        lupon: 'In Progress',
        resolved: 'Resolved',
        'no-show': 'No Show',
        'certificate-action': 'No Show'
      };
      return statusMap[blotterStatus] || defaultStatus;
    };

    const mapStatusToProgress = (appStatus) => {
      const statusProgressMap = {
        Pending: 0,
        'In Progress': 50,
        Resolved: 100,
        'No Show': 100,
        Rejected: 0
      };
      return statusProgressMap[appStatus] ?? 0;
    };

    const normalizeText = (value) =>
      (value || '')
        .toString()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const complaintIds = complaints.map((item) => item._id.toString());
    let blotterMap = new Map();

    if (complaintIds.length > 0) {
      const noteMatchers = complaintIds.map((id) => ({
        notes: { $regex: `Complaint ID:\\s*${id}`, $options: 'i' }
      }));

      const blotterMatches = await Blotter.find({
        isDeleted: false,
        $or: [
          { sourceComplaint: { $in: complaintIds } },
          ...noteMatchers
        ]
      })
        .populate('defendantUser', 'firstName lastName email')
        .sort({ createdAt: -1 });

      const getComplaintIdFromBlotter = (blotter) => {
        if (blotter.sourceComplaint) {
          return blotter.sourceComplaint.toString();
        }

        const notes = blotter.notes || '';
        const match = notes.match(/Complaint ID:\s*([a-f0-9]{24})/i);
        return match ? match[1] : null;
      };

      blotterMatches.forEach((blotter) => {
        const complaintId = getComplaintIdFromBlotter(blotter);
        if (complaintId && !blotterMap.has(complaintId)) {
          blotterMap.set(complaintId, blotter);
        }
      });

      // Fallback for older mirrored records where notes were later overwritten,
      // but the blotter is already moved by admin to ongoing buckets.
      const unresolvedComplaints = complaints.filter(
        (complaint) => !blotterMap.has(complaint._id.toString())
      );

      if (unresolvedComplaints.length > 0) {
        const complainantName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

        const fallbackBlotters = await Blotter.find({
          isDeleted: false,
          complainant: complainantName,
          status: { $in: ['ongoing', 'ongoing-no-mediation'] }
        })
          .populate('defendantUser', 'firstName lastName email')
          .sort({ updatedAt: -1, createdAt: -1 });

        const usedBlotterIds = new Set(Array.from(blotterMap.values()).map((item) => item._id.toString()));

        unresolvedComplaints.forEach((complaint) => {
          const complaintId = complaint._id.toString();
          const normalizedTitle = normalizeText(complaint.title);
          const normalizedDescriptionSnippet = normalizeText(complaint.description).slice(0, 80);

          const candidatePool = fallbackBlotters.filter(
            (blotter) => !usedBlotterIds.has(blotter._id.toString())
          );

          let bestMatch = candidatePool.find((blotter) => {
            const blotterDescription = normalizeText(blotter.description);

            if (normalizedTitle && blotterDescription.includes(normalizedTitle)) {
              return true;
            }

            if (normalizedDescriptionSnippet && blotterDescription.includes(normalizedDescriptionSnippet)) {
              return true;
            }

            return false;
          });

          if (!bestMatch && candidatePool.length === 1) {
            bestMatch = candidatePool[0];
          }

          if (bestMatch) {
            blotterMap.set(complaintId, bestMatch);
            usedBlotterIds.add(bestMatch._id.toString());
          }
        });
      }
    }

    const manualBlotterCards = manualBlottersForUser.map((blotter) => {
      const appStatus = mapBlotterStatusToAppStatus(blotter.status, 'Pending');
      const hasEmailSubpoena = !!(blotter.subpoena?.sentAt && Array.isArray(blotter.subpoena?.sentTo) && blotter.subpoena.sentTo.length > 0);

      return {
        _id: blotter._id,
        title: blotter.caseNumber || 'Manual Blotter',
        description: blotter.description,
        category: 'Manual Blotter',
        priority: 'Medium',
        status: appStatus,
        progress: mapStatusToProgress(appStatus),
        createdAt: blotter.createdAt,
        isAnonymous: blotter.isAnonymous || false,
        blotterUpdate: {
          caseNumber: blotter.caseNumber,
          blotterStatus: blotter.status,
          mediationDate: blotter.dateOfMeeting || null,
          mediationTime: blotter.mediationTime || null,
          subpoenaDelivery: hasEmailSubpoena ? 'email' : 'physical',
          subpoenaSentAt: blotter.subpoena?.sentAt || null,
          defendantAttached: !!blotter.defendantUser,
          complainantAttached: !!blotter.complainantUser
        }
      };
    });

    let enrichedComplaints = complaints.map((complaint) => {
      const complaintObj = complaint.toObject();
      const linkedBlotter = blotterMap.get(complaintObj._id.toString());

      if (!linkedBlotter) {
        return complaintObj;
      }

      const mappedStatus = mapBlotterStatusToAppStatus(linkedBlotter.status, complaintObj.status);
      const hasEmailSubpoena = !!(linkedBlotter.subpoena?.sentAt && Array.isArray(linkedBlotter.subpoena?.sentTo) && linkedBlotter.subpoena.sentTo.length > 0);

      return {
        ...complaintObj,
        status: mappedStatus,
        progress: mapStatusToProgress(mappedStatus),
        blotterUpdate: {
          caseNumber: linkedBlotter.caseNumber,
          blotterStatus: linkedBlotter.status,
          mediationDate: linkedBlotter.dateOfMeeting || null,
          mediationTime: linkedBlotter.mediationTime || null,
          subpoenaDelivery: hasEmailSubpoena ? 'email' : 'physical',
          subpoenaSentAt: linkedBlotter.subpoena?.sentAt || null,
          defendantAttached: !!linkedBlotter.defendantUser
        }
      };
    });

    const mergedComplaints = [...enrichedComplaints];
    manualBlotterCards.forEach((manualBlotter) => {
      mergedComplaints.push(manualBlotter);
    });

    if (status) {
      enrichedComplaints = mergedComplaints.filter((complaint) => complaint.status === status);
    } else {
      enrichedComplaints = mergedComplaints;
    }

    const total = status
      ? enrichedComplaints.length
      : await Complaint.countDocuments(filter) + manualBlotterCards.length;

    res.json({
      success: true,
      data: {
        complaints: enrichedComplaints,
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

    if (complaint.user) {
      const linkedBlotter = await Blotter.findOne({
        isDeleted: false,
        sourceComplaint: complaint._id
      }).select('caseNumber status');

      await createNotification({
        recipient: complaint.user,
        ...getStatusNotification(linkedBlotter || { status, caseNumber: complaint._id })
      });
    }

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
