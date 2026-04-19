const express = require('express');
const { body, validationResult } = require('express-validator');
const Blotter = require('../models/Blotter');
const { protectAdmin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all blotters
// @route   GET /api/blotters
// @access  Private (Admin)
router.get('/', protectAdmin, async (req, res) => {
  try {
    const { filterType } = req.query;

    let query = { isDeleted: false };

    console.log('Blotters filter - filterType:', filterType);

    // Filter by type
    if (filterType && filterType !== 'all') {
      if (filterType === 'recently-deleted') {
        query = { isDeleted: true };
      } else if (filterType === 'new') {
        query.status = 'new';
      } else if (filterType === 'ongoing') {
        query.status = { $in: ['ongoing', 'ongoing-no-mediation', 'ongoing-2nd', 'ongoing-3rd'] };
      } else if (filterType === 'ongoing-new') {
        query.status = 'ongoing';
      } else if (filterType === 'ongoing-no-mediation') {
        query.status = 'ongoing-no-mediation';
      } else if (filterType === 'ongoing-2nd') {
        query.status = 'ongoing-2nd';
      } else if (filterType === 'ongoing-3rd') {
        query.status = 'ongoing-3rd';
      } else if (filterType === 'closed') {
        query.status = { $in: ['no-show', 'resolved', 'certificate-action'] };
      } else if (filterType === 'no-show') {
        query.status = 'no-show';
      } else if (filterType === 'resolved') {
        query.status = 'resolved';
      } else if (filterType === 'certificate-action') {
        query.status = 'certificate-action';
      } else if (filterType === 'lupon') {
        query.status = 'lupon';
      }
    }

    console.log('Query object:', JSON.stringify(query));

    const sort = filterType === 'recently-deleted' ? { deletedAt: -1, createdAt: -1 } : { createdAt: -1 };

    const blotters = await Blotter.find(query).sort(sort);

    console.log(`[Blotters] filterType: ${filterType} | Found: ${blotters.length} blotters`);

    res.json({
      success: true,
      message: 'Blotters retrieved successfully',
      data: blotters
    });
  } catch (error) {
    console.error('Error fetching blotters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blotters',
      error: error.message
    });
  }
});

// @desc    Get blotter by ID
// @route   GET /api/blotters/:id
// @access  Private (Admin)
router.get('/:id', protectAdmin, async (req, res) => {
  try {
    const blotter = await Blotter.findOne({ _id: req.params.id, isDeleted: false });

    if (!blotter) {
      return res.status(404).json({
        success: false,
        message: 'Blotter not found'
      });
    }

    res.json({
      success: true,
      message: 'Blotter retrieved successfully',
      data: blotter
    });
  } catch (error) {
    console.error('Error fetching blotter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blotter',
      error: error.message
    });
  }
});

// @desc    Create a new blotter
// @route   POST /api/blotters
// @access  Private (Admin)
router.post('/', protectAdmin, [
  body('caseNumber').notEmpty().withMessage('Case number is required'),
  body('complainant').notEmpty().withMessage('Complainant name is required'),
  body('respondent').notEmpty().withMessage('Respondent name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('status').isIn(['new', 'ongoing', 'ongoing-2nd', 'ongoing-3rd', 'no-show', 'resolved', 'certificate-action']).withMessage('Invalid status')
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

    const { caseNumber, complainant, respondent, description, status, caseType, mediationCount } = req.body;

    const blotter = new Blotter({
      caseNumber,
      complainant,
      respondent,
      description,
      status,
      caseType: caseType || 'regular',
      mediationCount: mediationCount || 0,
      createdBy: req.user._id,
      createdAt: new Date()
    });

    await blotter.save();

    res.status(201).json({
      success: true,
      message: 'Blotter created successfully',
      data: blotter
    });
  } catch (error) {
    console.error('Error creating blotter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blotter',
      error: error.message
    });
  }
});

// @desc    Update blotter
// @route   PUT /api/blotters/:id
// @access  Private (Admin)
router.put('/:id', protectAdmin, async (req, res) => {
  try {
    const { caseNumber, complainant, respondent, description, status, mediationCount, documentation, mediationDate, mediationTime } = req.body;

    let blotter = await Blotter.findOne({ _id: req.params.id, isDeleted: false });

    if (!blotter) {
      return res.status(404).json({
        success: false,
        message: 'Blotter not found'
      });
    }

    // Update fields
    if (caseNumber) blotter.caseNumber = caseNumber;
    if (complainant) blotter.complainant = complainant;
    if (respondent) blotter.respondent = respondent;
    if (description) blotter.description = description;
    if (status) {
      blotter.status = status;
      // Update mediation count if moving to 2nd mediation
      if (status === 'ongoing-2nd') {
        blotter.mediationCount = (blotter.mediationCount || 0) + 1;
      }
    }
    if (mediationCount !== undefined) blotter.mediationCount = mediationCount;
    if (documentation) blotter.notes = documentation;
    if (mediationDate) blotter.dateOfMeeting = new Date(mediationDate);
    
    blotter.updatedAt = new Date();

    // Track resolution if moving to resolved or closed status
    if (status === 'resolved' || status === 'no-show' || status === 'certificate-action') {
      blotter.resolvedAt = new Date();
      if (status === 'resolved' && documentation) {
        blotter.resolution = documentation;
      }
    }

    await blotter.save();

    res.json({
      success: true,
      message: 'Blotter updated successfully',
      data: blotter
    });
  } catch (error) {
    console.error('Error updating blotter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blotter',
      error: error.message
    });
  }
});

// @desc    Delete blotter
// @route   DELETE /api/blotters/:id
// @access  Private (Admin)
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const blotter = await Blotter.findOne({ _id: req.params.id, isDeleted: false });

    if (!blotter) {
      return res.status(404).json({
        success: false,
        message: 'Blotter not found'
      });
    }

    blotter.isDeleted = true;
    blotter.deletedAt = new Date();
    blotter.deletedBy = req.user ? req.user._id : undefined;
    blotter.updatedAt = new Date();

    await blotter.save();

    res.json({
      success: true,
      message: 'Blotter moved to Recently Deleted',
      data: blotter
    });
  } catch (error) {
    console.error('Error deleting blotter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blotter',
      error: error.message
    });
  }
});

module.exports = router;
