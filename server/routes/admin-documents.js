const express = require('express');
const { body, validationResult } = require('express-validator');
const DocumentTemplate = require('../models/DocumentTemplate');
const { protectAdmin, authorize } = require('../middleware/auth');

const router = express.Router();

const TEMPLATE_DEFINITIONS = {
  subpoena: {
    key: 'subpoena',
    name: 'Subpoena Template',
    description: 'Used when generating subpoena subject and body in Blotter Management.',
    subjectTemplate: 'Subpoena Notice - {{caseNumber}}',
    headerImageUrl: '',
    headerImageAlt: 'Municipality Logo',
    bodyTemplate:
      '<div style="text-align:center; margin-bottom: 16px;">{{logoHtml}}</div>' +
      '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #111827;">' +
      '<p style="margin-top: 0;">This is to inform {{defendantName}} regarding blotter case {{caseNumber}}.</p>' +
      '<p>Complainant: {{complainantName}}<br />Complainant Address: {{complainantAddress}}<br />Respondent: {{defendantName}}<br />Defendant Address: {{defendantAddress}}</p>' +
      '<p>You are required to appear for the 1st mediation on {{scheduleDate}} at {{scheduleTime}}.</p>' +
      '<p>Date prepared: {{todayDate}}</p>' +
      '<p>Please bring any supporting documents and arrive at least 15 minutes before the schedule.</p>' +
      '</div>',
    placeholders: ['caseNumber', 'complainantName', 'defendantName', 'complainantAddress', 'defendantAddress', 'scheduleDate', 'scheduleTime', 'today', 'todayDate', 'logoHtml']
  },
  certificate_to_file_action: {
    key: 'certificate_to_file_action',
    name: 'Certificate to File Action Template',
    description: 'Used for documentation when status is Certificate to File Action.',
    subjectTemplate: 'Certificate to File Action - {{caseNumber}}',
    headerImageUrl: '',
    headerImageAlt: 'Document Logo',
    bodyTemplate:
      'For blotter case {{caseNumber}}, this certifies that barangay-level mediation interventions were completed and further filing action is endorsed.\\n\\n' +
      'Complainant: {{complainantName}}\\n' +
      'Respondent: {{defendantName}}\\n' +
      'Date prepared: {{today}}\\n\\n' +
      'Remarks: {{remarks}}',
    placeholders: ['caseNumber', 'complainantName', 'defendantName', 'complainantAddress', 'defendantAddress', 'today', 'todayDate', 'remarks']
  }
};

router.use(protectAdmin);

const normalizeTemplateKey = (value = '') => String(value)
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 60);

const toResponsePayload = (templateKey, storedTemplate) => {
  const base = TEMPLATE_DEFINITIONS[templateKey];
  if (!base) {
    return null;
  }

  if (!storedTemplate) {
    return {
      ...base,
      isDefault: true,
      isActive: true,
      headerImageUrl: '',
      headerImageAlt: base.headerImageAlt || 'Document logo',
      updatedAt: null
    };
  }

  return {
    key: storedTemplate.key,
    name: storedTemplate.name || base.name,
    description: storedTemplate.description || base.description,
    subjectTemplate: storedTemplate.subjectTemplate || base.subjectTemplate,
    headerImageUrl: storedTemplate.headerImageUrl || base.headerImageUrl || '',
    headerImageAlt: storedTemplate.headerImageAlt || base.headerImageAlt || 'Document logo',
    bodyTemplate: storedTemplate.bodyTemplate || base.bodyTemplate,
    placeholders: Array.isArray(storedTemplate.placeholders) && storedTemplate.placeholders.length > 0
      ? storedTemplate.placeholders
      : base.placeholders,
    isDefault: false,
    isActive: storedTemplate.isActive,
    updatedAt: storedTemplate.updatedAt
  };
};

// @desc    Get all configurable document templates
// @route   GET /api/admin/documents/templates
// @access  Private (Admin)
router.get('/templates', authorize('manage_complaints', 'manage_settings', 'admin_panel'), async (req, res) => {
  try {
    const storedTemplates = await DocumentTemplate.find().sort({ updatedAt: -1, createdAt: -1 });

    const storedByKey = storedTemplates.reduce((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {});

    const systemTemplates = Object.keys(TEMPLATE_DEFINITIONS).map((key) => toResponsePayload(key, storedByKey[key]));

    const customTemplates = storedTemplates
      .filter((item) => !TEMPLATE_DEFINITIONS[item.key])
      .map((item) => ({
        key: item.key,
        name: item.name,
        description: item.description || '',
        subjectTemplate: item.subjectTemplate || '',
        headerImageUrl: item.headerImageUrl || '',
        headerImageAlt: item.headerImageAlt || 'Document logo',
        bodyTemplate: item.bodyTemplate || '',
        placeholders: Array.isArray(item.placeholders) ? item.placeholders : [],
        isDefault: false,
        isActive: item.isActive,
        updatedAt: item.updatedAt
      }));

    const templates = [...systemTemplates, ...customTemplates];

    res.json({
      success: true,
      data: {
        templates
      }
    });
  } catch (error) {
    console.error('Get document templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching document templates'
    });
  }
});

// @desc    Update a document template
// @route   PUT /api/admin/documents/templates/:key
// @access  Private (Admin)
router.put('/templates/:key', [
  body('name').optional().trim().notEmpty().withMessage('Template name cannot be empty'),
  body('description').optional().trim(),
  body('subjectTemplate').optional().trim(),
  body('headerImageUrl').optional().trim(),
  body('headerImageAlt').optional().trim(),
  body('bodyTemplate').trim().notEmpty().withMessage('Template body is required'),
  body('placeholders').optional().isArray().withMessage('Placeholders must be an array')
], authorize('manage_complaints', 'manage_settings', 'admin_panel'), async (req, res) => {
  try {
    const templateKey = normalizeTemplateKey(req.params.key || '');
    if (!templateKey) {
      return res.status(400).json({
        success: false,
        message: 'Template key is required'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const defaults = TEMPLATE_DEFINITIONS[templateKey] || {
      name: 'Document Template',
      description: '',
      subjectTemplate: '',
      headerImageUrl: '',
      headerImageAlt: 'Document logo',
      placeholders: []
    };
    const {
      name,
      description,
      subjectTemplate,
      headerImageUrl,
      headerImageAlt,
      bodyTemplate,
      placeholders,
      isActive
    } = req.body;

    const nextPlaceholders = Array.isArray(placeholders)
      ? placeholders.map((value) => (value || '').toString().trim()).filter(Boolean)
      : defaults.placeholders;

    const updatedTemplate = await DocumentTemplate.findOneAndUpdate(
      { key: templateKey },
      {
        $set: {
          key: templateKey,
          name: name || defaults.name,
          description: description !== undefined ? description : defaults.description,
          subjectTemplate: subjectTemplate !== undefined ? subjectTemplate : defaults.subjectTemplate,
          headerImageUrl: headerImageUrl !== undefined ? headerImageUrl : defaults.headerImageUrl,
          headerImageAlt: headerImageAlt !== undefined ? headerImageAlt : defaults.headerImageAlt,
          bodyTemplate,
          placeholders: nextPlaceholders,
          isActive: isActive !== undefined ? !!isActive : true,
          updatedBy: req.admin ? req.admin._id : undefined
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      message: 'Document template updated successfully',
      data: {
        template: TEMPLATE_DEFINITIONS[templateKey]
          ? toResponsePayload(templateKey, updatedTemplate)
          : {
              key: updatedTemplate.key,
              name: updatedTemplate.name,
              description: updatedTemplate.description || '',
              subjectTemplate: updatedTemplate.subjectTemplate || '',
              headerImageUrl: updatedTemplate.headerImageUrl || '',
              headerImageAlt: updatedTemplate.headerImageAlt || 'Document logo',
              bodyTemplate: updatedTemplate.bodyTemplate || '',
              placeholders: Array.isArray(updatedTemplate.placeholders) ? updatedTemplate.placeholders : [],
              isDefault: false,
              isActive: updatedTemplate.isActive,
              updatedAt: updatedTemplate.updatedAt
            }
      }
    });
  } catch (error) {
    console.error('Update document template error:', error.message || error);
    console.error('Stack:', error.stack);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors)
        .map(field => `${field}: ${error.errors[field].message}`)
        .join('; ');
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating document template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Create a new custom document template
// @route   POST /api/admin/documents/templates
// @access  Private (Admin)
router.post('/templates', [
  body('name').trim().notEmpty().withMessage('Template name is required'),
  body('description').optional().trim(),
  body('subjectTemplate').optional().trim(),
  body('headerImageUrl').optional().trim(),
  body('headerImageAlt').optional().trim(),
  body('bodyTemplate').trim().notEmpty().withMessage('Template body is required'),
  body('placeholders').optional().isArray().withMessage('Placeholders must be an array')
], authorize('manage_complaints', 'manage_settings', 'admin_panel'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      description,
      subjectTemplate,
      headerImageUrl,
      headerImageAlt,
      bodyTemplate,
      placeholders,
      isActive
    } = req.body;

    const baseKey = normalizeTemplateKey(name);
    if (!baseKey) {
      return res.status(400).json({
        success: false,
        message: 'Template name must contain at least one letter or number'
      });
    }

    let templateKey = baseKey;
    let suffix = 1;
    while (await DocumentTemplate.exists({ key: templateKey })) {
      templateKey = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    const nextPlaceholders = Array.isArray(placeholders)
      ? placeholders.map((value) => (value || '').toString().trim()).filter(Boolean)
      : [];

    const createdTemplate = await DocumentTemplate.create({
      key: templateKey,
      name,
      description: description || '',
      subjectTemplate: subjectTemplate || '',
      headerImageUrl: headerImageUrl || '',
      headerImageAlt: headerImageAlt || 'Document logo',
      bodyTemplate,
      placeholders: nextPlaceholders,
      isActive: isActive !== undefined ? !!isActive : true,
      updatedBy: req.admin ? req.admin._id : undefined
    });

    res.status(201).json({
      success: true,
      message: 'Document template created successfully',
      data: {
        template: {
          key: createdTemplate.key,
          name: createdTemplate.name,
          description: createdTemplate.description || '',
          subjectTemplate: createdTemplate.subjectTemplate || '',
          headerImageUrl: createdTemplate.headerImageUrl || '',
          headerImageAlt: createdTemplate.headerImageAlt || 'Document logo',
          bodyTemplate: createdTemplate.bodyTemplate || '',
          placeholders: Array.isArray(createdTemplate.placeholders) ? createdTemplate.placeholders : [],
          isDefault: false,
          isActive: createdTemplate.isActive,
          updatedAt: createdTemplate.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Create document template error:', error.message || error);
    console.error('Stack:', error.stack);

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors)
        .map(field => `${field}: ${error.errors[field].message}`)
        .join('; ');
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating document template',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Delete a document template
// @route   DELETE /api/admin/documents/templates/:key
// @access  Private (Admin)
router.delete('/templates/:key', authorize('manage_complaints', 'manage_settings', 'admin_panel'), async (req, res) => {
  try {
    const templateKey = normalizeTemplateKey(req.params.key || '');
    if (!templateKey) {
      return res.status(400).json({
        success: false,
        message: 'Template key is required'
      });
    }

    const deletedTemplate = await DocumentTemplate.findOneAndDelete({ key: templateKey });
    if (!deletedTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const isSystemTemplate = !!TEMPLATE_DEFINITIONS[templateKey];
    res.json({
      success: true,
      message: isSystemTemplate
        ? 'Template customization removed. Default template has been restored.'
        : 'Template deleted successfully',
      data: {
        key: templateKey,
        restoredDefault: isSystemTemplate
      }
    });
  } catch (error) {
    console.error('Delete document template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting document template'
    });
  }
});

module.exports = router;
