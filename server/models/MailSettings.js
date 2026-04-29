const mongoose = require('mongoose');

const mailSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'default',
    trim: true
  },
  smtpHost: {
    type: String,
    trim: true,
    default: ''
  },
  smtpPort: {
    type: Number,
    default: null
  },
  smtpSecure: {
    type: Boolean,
    default: false
  },
  smtpUser: {
    type: String,
    trim: true,
    default: ''
  },
  smtpPass: {
    type: String,
    default: ''
  },
  smtpFromEmail: {
    type: String,
    trim: true,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MailSettings', mailSettingsSchema);