const express = require('express');
const { protectUser, protectAdmin } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, uploadAttachmentAny, extractImageInfo, extractUploadInfo, handleUploadError, deleteImage } = require('../middleware/upload');

const router = express.Router();

// @desc    Upload single image for public signup profile picture
// @route   POST /api/upload/public-profile
// @access  Public
router.post('/public-profile', uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const imageInfo = extractImageInfo(req.file);

    res.status(201).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        image: imageInfo,
        profilePicture: imageInfo.url
      }
    });
  } catch (error) {
    console.error('Public profile upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading image'
    });
  }
});

// @desc    Upload single image
// @route   POST /api/upload/single
// @access  Private (User or Admin)
router.post('/single', protectUser, uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const imageInfo = extractImageInfo(req.file);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        image: imageInfo
      }
    });
  } catch (error) {
    console.error('Single upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading image'
    });
  }
});

// @desc    Upload single image (Admin)
// @route   POST /api/upload/single-admin
// @access  Private (Admin)
router.post('/single-admin', protectAdmin, uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const imageInfo = extractImageInfo(req.file);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        image: imageInfo
      }
    });
  } catch (error) {
    console.error('Single admin upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading image'
    });
  }
});

// @desc    Upload multiple images
// @route   POST /api/upload/multiple
// @access  Private (User or Admin)
router.post('/multiple', protectUser, uploadMultiple, handleUploadError, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const images = req.files.map(file => extractImageInfo(file));

    res.status(201).json({
      success: true,
      message: `${images.length} images uploaded successfully`,
      data: {
        images,
        count: images.length
      }
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading images'
    });
  }
});

// @desc    Upload images for complaint (with validation)
// @route   POST /api/upload/complaint
// @access  Private (User or Admin)
router.post('/complaint', protectUser, uploadMultiple, handleUploadError, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Validate number of files (max 5 for complaint images)
    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed for complaint'
      });
    }

    const images = req.files.map(file => extractImageInfo(file));

    res.status(201).json({
      success: true,
      message: `${images.length} complaint images uploaded successfully`,
      data: {
        images,
        count: images.length
      }
    });
  } catch (error) {
    console.error('Complaint upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading complaint images'
    });
  }
});

// @desc    Delete image
// @route   DELETE /api/upload/:publicId
// @access  Private (User or Admin)
router.delete('/:publicId', protectUser, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    // Delete image from Cloudinary
    const deleted = await deleteImage(publicId);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete image'
      });
    }

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting image'
    });
  }
});

// @desc    Upload profile picture
// @route   POST /api/upload/profile
// @access  Private (User or Admin)
router.post('/profile', protectUser, uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const imageInfo = extractImageInfo(req.file);

    // Update user's profile picture in database
    const User = require('../models/User');
    const Admin = require('../models/Admin');

    // Try to update user first
    let updated = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: imageInfo.url },
      { new: true }
    );

    // If not a user, try to update admin
    if (!updated) {
      updated = await Admin.findByIdAndUpdate(
        req.admin._id,
        { profilePicture: imageInfo.url },
        { new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        image: imageInfo,
        profilePicture: imageInfo.url
      }
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading profile picture'
    });
  }
});

// @desc    Upload admin attachment for complaint notes
// @route   POST /api/upload/attachment
// @access  Private (Admin)
router.post('/attachment', protectAdmin, uploadAttachmentAny, handleUploadError, async (req, res) => {
  try {
    const uploadedFile = req.file || (Array.isArray(req.files) ? req.files[0] : null);

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const attachmentInfo = extractUploadInfo(uploadedFile);

    res.status(201).json({
      success: true,
      message: 'Attachment uploaded successfully',
      data: {
        attachment: attachmentInfo
      }
    });
  } catch (error) {
    console.error('Attachment upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading attachment'
    });
  }
});

module.exports = router;
