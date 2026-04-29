const mongoose = require('mongoose');

const blotterSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    required: [true, 'Case number is required'],
    unique: true,
    trim: true,
    index: true
  },
  complainant: {
    type: String,
    required: [true, 'Complainant name is required'],
    trim: true
  },
  complainantUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  respondent: {
    type: String,
    required: [true, 'Respondent name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  location: {
    type: String,
    trim: true
  },
  isFilingComplaintAgainstSomeone: {
    type: Boolean,
    default: false
  },
  respondentName: {
    type: String,
    trim: true,
    default: ''
  },
  respondentRelationship: {
    type: String,
    trim: true,
    default: ''
  },
  respondentAddress: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: [
      'new',
      'ongoing',
      'ongoing-no-mediation',
      'ongoing-2nd',
      'ongoing-3rd',
      'no-show',
      'resolved',
      'certificate-action',
      'lupon'
    ],
    default: 'new',
    index: true
  },
  caseType: {
    type: String,
    enum: ['regular', 'lupon'],
    default: 'regular'
  },
  isAnonymous: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
    index: true
  },
  mediationCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  sourceComplaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint'
  },
  dateOfMeeting: {
    type: Date
  },
  mediationTime: {
    type: String,
    trim: true
  },
  resolution: {
    type: String,
    trim: true,
    maxlength: [2000, 'Resolution cannot exceed 2000 characters']
  },
  notes: {
    type: String,
    trim: true
  },
  attachments: [
    {
      filename: String,
      url: String,
      resourceType: {
        type: String,
        enum: ['image', 'video', 'document'],
        default: 'image'
      },
      format: String,
      size: Number,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  generatedDocuments: [
    {
      filename: String,
      url: String,
      resourceType: {
        type: String,
        enum: ['document'],
        default: 'document'
      },
      documentType: String,
      subject: String,
      body: String,
      sentTo: [String],
      format: String,
      size: Number,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  defendantUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  subpoena: {
    subject: {
      type: String,
      trim: true,
      maxlength: [200, 'Subpoena subject cannot exceed 200 characters']
    },
    body: {
      type: String,
      trim: true,
      maxlength: [50000, 'Subpoena body cannot exceed 50000 characters']
    },
    complainantEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    defendantEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    sentAt: {
      type: Date
    },
    sentTo: [String],
    sendError: {
      type: String,
      trim: true
    }
  }
});

// Index for efficient queries
blotterSchema.index({ status: 1, createdAt: -1 });
blotterSchema.index({ complainant: 1 });
blotterSchema.index({ respondent: 1 });
// Auto-remove soft-deleted blotters 31 days after deletion timestamp.
blotterSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 31 * 24 * 60 * 60,
    partialFilterExpression: { isDeleted: true }
  }
);

module.exports = mongoose.model('Blotter', blotterSchema);
