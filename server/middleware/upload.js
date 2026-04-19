const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barangay-connect', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    public_id: (req, file) => {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      return `${timestamp}_${randomString}`;
    },
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' }, // Limit dimensions
      { quality: 'auto' }, // Auto optimize quality
      { fetch_format: 'auto' } // Auto format
    ]
  }
});

// Configure Cloudinary storage for generic media attachments (images/videos)
const mediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'barangay-connect/attachments',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      return `${timestamp}_${randomString}`;
    }
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  // Check if the file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// File filter for image or video attachments
const mediaFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image or video files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
    files: 5 // Maximum 5 files
  }
});

// Configure multer for media attachments
const uploadAttachment = multer({
  storage: mediaStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for media attachments
    files: 1
  }
});

// Single file upload middleware
exports.uploadSingle = upload.single('image');

// Multiple files upload middleware
exports.uploadMultiple = upload.array('images', 5);

// Single media attachment upload middleware
exports.uploadAttachmentSingle = uploadAttachment.single('attachment');
exports.uploadAttachmentAny = uploadAttachment.any();

// Helper function to extract image info from Cloudinary response
exports.extractImageInfo = (file) => {
  const normalizedUrl = file.secure_url || file.path || file.url || '';
  return {
    url: normalizedUrl,
    secureUrl: file.secure_url || normalizedUrl,
    path: file.path || normalizedUrl,
    publicId: file.public_id || file.filename,
    originalName: file.originalname || file.original_filename,
    size: file.bytes || file.size,
    format: file.format,
    uploadedAt: new Date()
  };
};

// Helper function to extract generic upload info from Cloudinary response
exports.extractUploadInfo = (file) => {
  const normalizedUrl = file.secure_url || file.path || file.url || '';
  const isVideo = file.resource_type === 'video' || file.mimetype?.startsWith('video/');
  return {
    url: normalizedUrl,
    secureUrl: file.secure_url || normalizedUrl,
    path: file.path || normalizedUrl,
    publicId: file.public_id || file.filename,
    originalName: file.originalname || file.original_filename,
    filename: file.originalname || file.original_filename || file.filename,
    size: file.bytes || file.size,
    format: file.format,
    resourceType: isVideo ? 'video' : 'image',
    uploadedAt: new Date()
  };
};

// Helper function to delete image from Cloudinary
exports.deleteImage = async (publicId) => {
  try {
    const imageDelete = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    if (imageDelete.result === 'ok') {
      return true;
    }

    const videoDelete = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    if (videoDelete.result === 'ok') {
      return true;
    }

    return imageDelete.result === 'not found' && videoDelete.result === 'not found';
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return false;
  }
};

// Middleware to handle upload errors
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB for images and 50MB for media attachments.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }

  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed (JPG, PNG, GIF, WebP). Maximum size is 10MB.'
    });
  }

  if (err.message === 'Only image or video files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only image or video files are allowed (JPG, PNG, GIF, WebP, MP4, MOV, AVI, MKV, WEBM). Maximum size is 50MB.'
    });
  }

  next(err);
};
