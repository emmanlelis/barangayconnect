const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const adminAuth = require('../middleware/auth');

router.post('/', adminAuth, async (req, res, next) => {
  try {
    const {
      title,
      category,
      priority,
      description,
      citizenName,
      citizenContact,
      citizenAddress,
      location,
      incidentDate,
      evidence
    } = req.body;

    // Validate required fields
    if (!title || !category || !priority || !description || !citizenName || !citizenContact || !citizenAddress) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Create complaint object
    const complaint = new Complaint({
      title,
      category,
      priority,
      description,
      reportedBy: {
        name: citizenName,
        contact: citizenContact,
        address: citizenAddress,
        type: 'citizen'
      },
      source: 'admin_manual',
      status: 'pending',
      priority,
      location,
      incidentDate: new Date(incidentDate),
      evidence: evidence || [],
      barangay: req.adminUser.barangay || 'Main Office'
    });

    // Save complaint
    const savedComplaint = await complaint.save();

    res.status(201).json({
      success: true,
      message: 'Complaint created successfully',
      data: savedComplaint
    });
    
    next();
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create complaint',
      error: error.message
    });
  }
});

module.exports = router;