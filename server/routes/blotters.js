const express = require('express');
const { body, validationResult } = require('express-validator');
const Blotter = require('../models/Blotter');
const User = require('../models/User');
const { protectAdmin, protectUser } = require('../middleware/auth');
const { getMailTransport, getMailSettingsResponse } = require('../services/mailService');
const cloudinary = require('cloudinary').v2;
const {
  createNotification,
  createNotifications,
  getReceivedNotification,
  getStatusNotification,
  resolveBlotterRecipients
} = require('../services/notificationService');

const router = express.Router();

const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const formatAddress = (address) => {
  if (!address) {
    return '';
  }

  const parts = [
    address.street,
    address.purok,
    address.barangay,
    address.city,
    address.province,
    address.zipCode
  ].map((value) => (value || '').toString().trim()).filter(Boolean);

  return parts.join(', ');
};
const renderTemplate = (template = '', values = {}) => String(template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
  const value = values[key];
  return value === undefined || value === null ? '' : String(value);
});

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isHtmlTemplate = (value = '') => /<[^>]+>/.test(value);
const buildTemplateHtml = (templateBody = '', renderedBody = '') => {
  if (isHtmlTemplate(templateBody)) {
    return renderedBody;
  }

  return `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${escapeHtml(renderedBody)}</pre>`;
};

// @desc    Get all blotters
// @route   GET /api/blotters
// @access  Private (Admin)
router.get('/', protectAdmin, async (req, res) => {
  try {
    const { filterType, priority } = req.query;

    let query = { isDeleted: false };

    console.log('Blotters filter - filterType:', filterType, 'priority:', priority);

    // Filter by type
    if (filterType && filterType !== 'all') {
      if (filterType === 'recently-deleted') {
        query = { isDeleted: true };
      } else if (filterType === 'new') {
        query.status = 'new';
        query.isAnonymous = { $ne: true }; // Exclude anonymous blotters
      } else if (filterType === 'anonymous') {
        query.status = 'new';
        query.isAnonymous = true;
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

    // Filter by priority
    if (priority && ['Low', 'Medium', 'High', 'Urgent'].includes(priority)) {
      query.priority = priority;
    }

    console.log('Query object:', JSON.stringify(query));

    const sort = filterType === 'recently-deleted' ? { deletedAt: -1, createdAt: -1 } : { createdAt: -1 };

    let blotters = await Blotter.find(query)
      .populate('defendantUser', 'firstName lastName email phoneNumber address')
      .populate('complainantUser', 'firstName lastName email phoneNumber address')
      .populate({
        path: 'sourceComplaint',
        populate: {
          path: 'user',
          select: 'firstName lastName email phoneNumber address'
        }
      })
      .sort(sort);

    // Mask sensitive information for anonymous blotters
    blotters = blotters.map(blotter => {
      if (blotter.isAnonymous) {
        const blotterObj = blotter.toObject();
        // Don't modify the actual names but frontend will handle masking
        // Just ensure location is not displayed
        blotterObj.location = '';
        // Mask defendant email if present
        if (blotterObj.subpoena?.defendantEmail) {
          blotterObj.subpoena.defendantEmail = '[hidden]';
        }
        if (blotterObj.subpoena?.complainantEmail) {
          blotterObj.subpoena.complainantEmail = '[hidden]';
        }
        return blotterObj;
      }
      return blotter;
    });

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

// @desc    Get blotters received by the current user
// @route   GET /api/blotters/received
// @access  Private (User)
router.get('/received', protectUser, async (req, res) => {
  try {
    const { status } = req.query;

    const query = {
      isDeleted: false,
      defendantUser: req.user._id
    };

    if (status && status !== 'All') {
      query.status = status;
    }

    const blotters = await Blotter.find(query)
      .populate('defendantUser', 'firstName lastName email phoneNumber address')
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      message: 'Received blotters retrieved successfully',
      data: {
        blotters
      }
    });
  } catch (error) {
    console.error('Error fetching received blotters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch received blotters',
      error: error.message
    });
  }
});

// @desc    Get scheduled mediations and visits
// @route   GET /api/blotters/scheduled
// @access  Private (Admin)
router.get('/scheduled', protectAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;

    let query = {
      isDeleted: false,
      dateOfMeeting: { $exists: true, $ne: null }
    };

    // Filter by month and year if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1); // month is 1-based
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.dateOfMeeting = {
        $exists: true,
        $ne: null,
        $gte: startDate,
        $lte: endDate
      };
    }

    const blotters = await Blotter.find(query)
      .populate('defendantUser', 'firstName lastName email phoneNumber')
      .populate('complainantUser', 'firstName lastName email phoneNumber')
      .select('caseNumber complainant respondent dateOfMeeting mediationTime status description priority')
      .sort({ dateOfMeeting: 1 });

    // Transform for calendar display
    const events = blotters.map(blotter => ({
      _id: blotter._id,
      caseNumber: blotter.caseNumber,
      title: `${blotter.caseNumber} - Mediation`,
      description: blotter.description,
      complainant: blotter.complainant,
      respondent: blotter.respondent,
      date: blotter.dateOfMeeting,
      time: blotter.mediationTime,
      status: blotter.status,
      priority: blotter.priority,
      type: 'mediation'
    }));

    res.json({
      success: true,
      message: 'Scheduled mediations retrieved successfully',
      data: events
    });
  } catch (error) {
    console.error('Error fetching scheduled mediations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled mediations',
      error: error.message
    });
  }
});

// @desc    Get blotter by ID
// @route   GET /api/blotters/:id
// @access  Private (Admin)
router.get('/:id', protectAdmin, async (req, res) => {
  try {
    const blotter = await Blotter.findOne({ _id: req.params.id, isDeleted: false })
      .populate('defendantUser', 'firstName lastName email phoneNumber address')
      .populate('complainantUser', 'firstName lastName email phoneNumber address')
      .populate({
        path: 'sourceComplaint',
        populate: {
          path: 'user',
          select: 'firstName lastName email phoneNumber address'
        }
      });

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
      createdBy: req.admin._id,
      createdAt: new Date()
    });

    await blotter.save();

    if (blotter.defendantUser) {
      await createNotification({
        recipient: blotter.defendantUser,
        ...getReceivedNotification(blotter)
      });
    }

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
    const {
      caseNumber,
      complainant,
      respondent,
      description,
      status,
      mediationCount,
      documentation,
      mediationDate,
      mediationTime,
      defendantId,
      subpoenaEnabled,
      subpoenaSubject,
      subpoenaBody,
      complainantEmail,
      defendantEmail,
      sendSubpoenaEmail
    } = req.body;

    let blotter = await Blotter.findOne({ _id: req.params.id, isDeleted: false });

    if (!blotter) {
      return res.status(404).json({
        success: false,
        message: 'Blotter not found'
      });
    }

    let selectedDefendant = null;
    const previousDefendantUser = blotter.defendantUser ? blotter.defendantUser.toString() : null;
    const previousStatus = blotter.status;
    if (defendantId) {
      selectedDefendant = await User.findOne({
        _id: defendantId,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
      });

      if (!selectedDefendant) {
        return res.status(404).json({
          success: false,
          message: 'Defendant account not found'
        });
      }
    }

    if (status === 'ongoing' && !(selectedDefendant || blotter.defendantUser)) {
      return res.status(400).json({
        success: false,
        message: 'Please attach a defendant account before scheduling 1st mediation'
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

    if (mediationDate) {
      const meetingDate = new Date(mediationDate);

      if (mediationTime && /^\d{2}:\d{2}$/.test(mediationTime)) {
        const [hourStr, minuteStr] = mediationTime.split(':');
        meetingDate.setHours(parseInt(hourStr, 10), parseInt(minuteStr, 10), 0, 0);
      }

      blotter.dateOfMeeting = meetingDate;
    }

    if (mediationTime) {
      blotter.mediationTime = mediationTime;
    }

    if (selectedDefendant) {
      blotter.defendantUser = selectedDefendant._id;
      const defendantFullName = `${selectedDefendant.firstName || ''} ${selectedDefendant.lastName || ''}`.trim();
      if (defendantFullName) {
        blotter.respondent = defendantFullName;
      }
    }

    const hasSubpoenaPayload =
      subpoenaEnabled || subpoenaSubject || subpoenaBody || complainantEmail || defendantEmail;

    if (hasSubpoenaPayload) {
      const cleanComplainantEmail = normalizeEmail(complainantEmail);
      const cleanDefendantEmail = normalizeEmail(defendantEmail || selectedDefendant?.email || '');

      blotter.subpoena = {
        ...(blotter.subpoena || {}),
        subject: subpoenaSubject || blotter.subpoena?.subject || '',
        body: subpoenaBody || blotter.subpoena?.body || '',
        complainantEmail: cleanComplainantEmail || undefined,
        defendantEmail: cleanDefendantEmail || undefined
      };
    }
    
    blotter.updatedAt = new Date();
    blotter.updatedBy = req.admin ? req.admin._id : undefined;

    // Track resolution if moving to resolved or closed status
    if (status === 'resolved' || status === 'no-show' || status === 'certificate-action') {
      blotter.resolvedAt = new Date();
      if (status === 'resolved' && documentation) {
        blotter.resolution = documentation;
      }
    }

    let subpoenaEmailResult = null;
    if (sendSubpoenaEmail) {
      if (!selectedDefendant && blotter.defendantUser) {
        selectedDefendant = await User.findOne({
          _id: blotter.defendantUser,
          $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        });
      }

      const recipients = [
        normalizeEmail(complainantEmail || blotter.subpoena?.complainantEmail),
        normalizeEmail(defendantEmail || blotter.subpoena?.defendantEmail || selectedDefendant?.email)
      ].filter(Boolean);

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
            message: 'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL in server/.env.'
          };
          blotter.subpoena = {
            ...(blotter.subpoena || {}),
            sendError: subpoenaEmailResult.message
          };
        } else {
          try {
            const templateValues = {
              caseNumber: blotter.caseNumber,
              complainantName: blotter.complainant,
              defendantName: selectedDefendant ? `${selectedDefendant.firstName || ''} ${selectedDefendant.lastName || ''}`.trim() : (blotter.respondent || 'Defendant'),
              scheduleDate: blotter.dateOfMeeting ? new Date(blotter.dateOfMeeting).toLocaleDateString() : '',
              scheduleTime: blotter.mediationTime || '',
              today: new Date().toLocaleDateString(),
              logoHtml: ''
            };

            const rawBodyTemplate = subpoenaBody || blotter.subpoena?.body || 'Please see subpoena details from BarangayConnect admin.';
            const renderedBody = renderTemplate(rawBodyTemplate, templateValues);

            const mailSettings = await getMailSettingsResponse();

            await transport.sendMail({
              from: mailSettings.smtpFromEmail || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
              to: recipients.join(', '),
              subject: subpoenaSubject || blotter.subpoena?.subject || `Subpoena Notice - ${blotter.caseNumber}`,
              text: isHtmlTemplate(rawBodyTemplate) ? renderedBody.replace(/<[^>]*>/g, ' ') : renderedBody,
              html: buildTemplateHtml(rawBodyTemplate, renderedBody)
            });

            // Save generated subpoena document to Cloudinary and attach to blotter
            try {
              const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><title>Subpoena - ${blotter.caseNumber}</title></head><body>${renderedBody}</body></html>`;
              const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                  {
                    resource_type: 'raw',
                    folder: 'barangay-connect/documents',
                    public_id: `${blotter.caseNumber}_subpoena_${Date.now()}`,
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
                  filename: `${blotter.caseNumber}_subpoena.html`,
                  url: uploadResult.secure_url,
                  resourceType: 'document',
                  format: uploadResult.format || 'html',
                  size: uploadResult.bytes || uploadResult.size || 0,
                  uploadedAt: new Date()
                });
                blotter.generatedDocuments = Array.isArray(blotter.generatedDocuments) ? blotter.generatedDocuments : [];
                blotter.generatedDocuments.push({
                  filename: `${blotter.caseNumber}_subpoena.html`,
                  url: uploadResult.secure_url,
                  resourceType: 'document',
                  documentType: 'subpoena',
                  subject: subpoenaSubject || blotter.subpoena?.subject || `Subpoena Notice - ${blotter.caseNumber}`,
                  body: subpoenaBody || blotter.subpoena?.body || '',
                  sentTo: recipients,
                  format: uploadResult.format || 'html',
                  size: uploadResult.bytes || uploadResult.size || 0,
                  uploadedAt: new Date()
                });
              }
            } catch (uploadErr) {
              console.error('Error uploading subpoena document:', uploadErr);
            }

            blotter.subpoena = {
              ...(blotter.subpoena || {}),
              sentAt: new Date(),
              sentTo: recipients,
              sendError: undefined
            };

            subpoenaEmailResult = {
              success: true,
              recipients
            };
          } catch (mailError) {
            blotter.subpoena = {
              ...(blotter.subpoena || {}),
              sendError: mailError.message
            };

            subpoenaEmailResult = {
              success: false,
              message: mailError.message
            };
          }
        }
      }
    }

    await blotter.save();
    blotter = await Blotter.findById(blotter._id)
      .populate('defendantUser', 'firstName lastName email phoneNumber address')
      .populate('complainantUser', 'firstName lastName email phoneNumber address')
      .populate({
        path: 'sourceComplaint',
        populate: {
          path: 'user',
          select: 'firstName lastName email phoneNumber address'
        }
      });

    try {
      const recipients = await resolveBlotterRecipients(blotter);
      if (recipients.length > 0 && previousStatus !== blotter.status) {
        await createNotifications(recipients, {
          ...getStatusNotification(blotter),
          metadata: {
            blotterId: blotter._id,
            caseNumber: blotter.caseNumber,
            status: blotter.status
          }
        });
      }

      if (selectedDefendant && selectedDefendant._id.toString() !== previousDefendantUser) {
        await createNotification({
          recipient: selectedDefendant._id,
          ...getReceivedNotification(blotter)
        });
      }
    } catch (notificationError) {
      console.error('Error sending blotter notifications:', notificationError);
    }

    res.json({
      success: true,
      message: 'Blotter updated successfully',
      data: {
        blotter,
        subpoenaEmailResult
      }
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

// @desc    Send subpoena email for an existing blotter
// @route   POST /api/blotters/subpoena-email
// @access  Private (Admin)
router.post('/subpoena-email', protectAdmin, async (req, res) => {
  try {
    const { caseNumber, subject, body, complainantEmail, defendantEmail } = req.body;

    if (!caseNumber) {
      return res.status(400).json({
        success: false,
        message: 'Case number is required'
      });
    }

    // Find the blotter by case number
    const blotter = await Blotter.findOne({ 
      caseNumber: caseNumber, 
      isDeleted: false 
    }).populate('defendantUser');

    if (!blotter) {
      return res.status(404).json({
        success: false,
        message: 'Blotter not found with the provided case number'
      });
    }

    const recipients = [
      normalizeEmail(complainantEmail || blotter.complainantEmail || blotter.subpoena?.complainantEmail),
      normalizeEmail(defendantEmail || (blotter.defendantUser?.email) || blotter.subpoena?.defendantEmail)
    ].filter(Boolean);

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No recipient email addresses provided for subpoena sending.'
      });
    }

    const transport = await getMailTransport();
    if (!transport) {
      return res.status(500).json({
        success: false,
        message: 'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL in server/.env.'
      });
    }

    const selectedDefendant = blotter.defendantUser;
    const templateValues = {
      caseNumber: blotter.caseNumber,
      complainantName: blotter.complainant,
      defendantName: selectedDefendant ? `${selectedDefendant.firstName || ''} ${selectedDefendant.lastName || ''}`.trim() : (blotter.respondent || 'Defendant'),
      complainantAddress: blotter.complainantAddress || '',
      defendantAddress: blotter.defendantAddress || '',
      scheduleDate: blotter.dateOfMeeting ? new Date(blotter.dateOfMeeting).toLocaleDateString() : '',
      scheduleTime: blotter.mediationTime || '',
      today: new Date().toLocaleDateString(),
      todayDate: new Date().toLocaleDateString(),
      logoHtml: ''
    };

    const rawBodyTemplate = body || blotter.subpoena?.body || 'Please see subpoena details from BarangayConnect admin.';
    const renderedBody = renderTemplate(rawBodyTemplate, templateValues);

    const mailSettings = await getMailSettingsResponse();

    await transport.sendMail({
      from: mailSettings.smtpFromEmail || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject: subject || blotter.subpoena?.subject || `Subpoena Notice - ${blotter.caseNumber}`,
      text: isHtmlTemplate(rawBodyTemplate) ? renderedBody.replace(/<[^>]*>/g, ' ') : renderedBody,
      html: buildTemplateHtml(rawBodyTemplate, renderedBody)
    });

    // Save generated subpoena document to Cloudinary and attach to blotter
    try {
      console.log('🔄 Starting document upload for case:', blotter.caseNumber);
      const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><title>Subpoena - ${blotter.caseNumber}</title></head><body>${renderedBody}</body></html>`;
      
      // Upload HTML as a buffer using upload_stream
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'barangay-connect/documents',
            public_id: `${blotter.caseNumber}_subpoena_${Date.now()}`,
            format: 'html'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(Buffer.from(htmlDoc, 'utf-8'));
      });

      console.log('✅ Cloudinary upload result:', uploadResult.secure_url);
      
      if (uploadResult && uploadResult.secure_url) {
        blotter.attachments = Array.isArray(blotter.attachments) ? blotter.attachments : [];
        const docAttachment = {
          filename: `${blotter.caseNumber}_subpoena.html`,
          url: uploadResult.secure_url,
          resourceType: 'document',
          format: uploadResult.format || 'html',
          size: uploadResult.bytes || uploadResult.size || 0,
          uploadedAt: new Date()
        };
        blotter.attachments.push(docAttachment);
        blotter.generatedDocuments = Array.isArray(blotter.generatedDocuments) ? blotter.generatedDocuments : [];
        blotter.generatedDocuments.push({
          filename: docAttachment.filename,
          url: docAttachment.url,
          resourceType: 'document',
          documentType: 'subpoena',
          subject: subject || blotter.subpoena?.subject || `Subpoena Notice - ${blotter.caseNumber}`,
          body: body || blotter.subpoena?.body || '',
          sentTo: recipients,
          format: docAttachment.format,
          size: docAttachment.size,
          uploadedAt: docAttachment.uploadedAt
        });
        console.log('📎 Attachment pushed to blotter. Total attachments:', blotter.attachments.length);
      } else {
        console.warn('⚠️ No secure_url in upload result:', uploadResult);
      }
    } catch (err) {
      console.error('❌ Error uploading subpoena document:', err.message || err);
    }
    // Update blotter with subpoena info
    blotter.subpoena = {
      ...(blotter.subpoena || {}),
      subject: subject || blotter.subpoena?.subject,
      body: body || blotter.subpoena?.body,
      sentAt: new Date(),
      sentTo: recipients,
      sendError: undefined
    };
    await blotter.save();
    
    console.log('✅ Blotter saved. Final attachments count:', blotter.attachments.length);
    console.log('📄 Final blotter attachments:', blotter.attachments.map(a => ({ filename: a.filename, resourceType: a.resourceType })));

    res.json({
      success: true,
      message: 'Subpoena email sent successfully',
      data: {
        recipients,
        sentAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error sending subpoena email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send subpoena email',
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
    blotter.deletedBy = req.admin ? req.admin._id : undefined;
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
