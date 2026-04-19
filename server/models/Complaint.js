const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Complaint title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Complaint description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
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
    ]
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Under Review', 'Resolved', 'Closed', 'Rejected'],
    default: 'Pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isAnonymous;
    },
    default: null
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  anonymousContact: {
    type: String,
    required: function() {
      return this.isAnonymous;
    }
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  images: [{
    url: String,
    publicId: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  assignedAt: Date,
  estimatedResolutionDate: Date,
  actualResolutionDate: Date,
  adminNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    attachments: [{
      url: String,
      publicId: String,
      filename: String
    }]
  }],
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    note: String
  }],
  userFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date
  },
  tags: [String],
  reportedBy: String, // For anonymous complaints
  isDuplicate: {
    type: Boolean,
    default: false
  },
  duplicateOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint'
  },
  // Mediation Fields
  requiresMediation: {
    type: Boolean,
    default: false
  },
  plaintiff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.requiresMediation;
    }
  },
  defendant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  mediationStatus: {
    type: String,
    enum: ['pending', 'scheduled', 'in-progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  mediationDate: Date,
  mediationNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  mediationAgreement: {
    content: String,
    agreedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    agreedAt: Date
  }
}, {
  timestamps: true
});

// Index for better search performance
complaintSchema.index({ title: 'text', description: 'text' });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ user: 1, createdAt: -1 });
complaintSchema.index({ category: 1, status: 1 });

// Auto-update progress based on status
complaintSchema.pre('save', function(next) {
  const statusProgressMap = {
    'Pending': 0,
    'Under Review': 20,
    'In Progress': 50,
    'Resolved': 100,
    'Closed': 100,
    'Rejected': 0
  };
  
  if (this.isModified('status') && statusProgressMap[this.status] !== undefined) {
    this.progress = statusProgressMap[this.status];
    
    if (this.status === 'Resolved' || this.status === 'Closed') {
      this.actualResolutionDate = new Date();
    }
  }
  
  next();
});

// Method to add status change to history
complaintSchema.methods.addStatusChange = function(newStatus, changedBy, note = '') {
  this.statusHistory.push({
    status: newStatus,
    changedBy,
    note
  });
  this.status = newStatus;
  return this.save();
};

// Method to add admin note
complaintSchema.methods.addAdminNote = function(note, addedBy, attachments = []) {
  this.adminNotes.push({
    note,
    addedBy,
    attachments
  });
  return this.save();
};

module.exports = mongoose.model('Complaint', complaintSchema);
