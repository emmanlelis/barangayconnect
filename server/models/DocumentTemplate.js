const mongoose = require('mongoose');

const documentTemplateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
    match: [/^[a-z0-9_-]+$/, 'Template key must only contain lowercase letters, numbers, underscores, and hyphens']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [120, 'Template name cannot exceed 120 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Template description cannot exceed 500 characters'],
    default: ''
  },
  subjectTemplate: {
    type: String,
    trim: true,
    maxlength: [200, 'Template subject cannot exceed 200 characters'],
    default: ''
  },
  headerImageUrl: {
    type: String,
    trim: true,
    default: ''
  },
  headerImageAlt: {
    type: String,
    trim: true,
    maxlength: [120, 'Header image alt text cannot exceed 120 characters'],
    default: 'Document logo'
  },
  bodyTemplate: {
    type: String,
    required: [true, 'Template body is required'],
    trim: true,
    maxlength: [50000, 'Template body cannot exceed 50000 characters']
  },
  placeholders: [{
    type: String,
    trim: true,
    maxlength: [80, 'Placeholder name cannot exceed 80 characters']
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DocumentTemplate', documentTemplateSchema);
