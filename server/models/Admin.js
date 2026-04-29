const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  authenticatorSecret: {
    type: String,
    select: false,
    default: null
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    enum: ['Barangay Captain', 'Barangay Councilor', 'Barangay Secretary', 'Barangay Treasurer', 'Barangay Administrator', 'Staff']
  },
  barangay: {
    type: String,
    required: [true, 'Barangay assignment is required']
  },
  department: {
    type: String,
    enum: ['General Administration', 'Health Services', 'Infrastructure', 'Peace and Order', 'Environmental Services', 'Social Services', 'All Departments'],
    default: 'All Departments'
  },
  permissions: [{
    type: String,
    enum: ['view_complaints', 'manage_complaints', 'assign_complaints', 'delete_complaints', 'manage_users', 'view_reports', 'manage_settings', 'admin_panel']
  }],
  profilePicture: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  assignedComplaints: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint'
  }],
  resolvedComplaints: {
    type: Number,
    default: 0
  },
  averageResolutionTime: {
    type: Number, // in hours
    default: 0
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
adminSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get full name
adminSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Check if admin account is locked
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Increment login attempts and lock account if needed
adminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts on successful login
adminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Update performance metrics
adminSchema.methods.updatePerformanceMetrics = async function() {
  const Complaint = mongoose.model('Complaint');
  
  const resolvedComplaints = await Complaint.countDocuments({
    assignedTo: this._id,
    status: 'Resolved'
  });
  
  const avgResolutionTime = await Complaint.aggregate([
    {
      $match: {
        assignedTo: this._id,
        status: 'Resolved',
        actualResolutionDate: { $exists: true }
      }
    },
    {
      $project: {
        resolutionTime: {
          $divide: [
            { $subtract: ['$actualResolutionDate', '$createdAt'] },
            1000 * 60 * 60 // Convert to hours
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgTime: { $avg: '$resolutionTime' }
      }
    }
  ]);
  
  this.resolvedComplaints = resolvedComplaints;
  this.averageResolutionTime = avgResolutionTime.length > 0 ? avgResolutionTime[0].avgTime : 0;
  
  return this.save();
};

module.exports = mongoose.model('Admin', adminSchema);
