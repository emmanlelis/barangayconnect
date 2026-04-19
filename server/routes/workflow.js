const express = require('express');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const router = express.Router();

// Get workflow statistics
router.get('/stats', async (req, res) => {
  try {
    // Get complaint counts by status
    const complaintStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to object for easier access
    const statusCounts = {};
    complaintStats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    const total = await Complaint.countDocuments();
    const resolved = statusCounts.resolved || 0;
    const closed = statusCounts.closed || 0;
    const rejected = statusCounts.rejected || 0;
    const pending = statusCounts.pending || 0;
    const inProgress = statusCounts['in-progress'] || 0;
    const underReview = statusCounts['under-review'] || 0;

    // Calculate average resolution time
    const resolvedComplaints = await Complaint.find({
      status: { $in: ['resolved', 'closed'] },
      resolvedAt: { $exists: true }
    });

    const avgResolutionTime = resolvedComplaints.length > 0 
      ? Math.round(resolvedComplaints.reduce((acc, complaint) => {
          const created = new Date(complaint.createdAt);
          const resolved = new Date(complaint.resolvedAt);
          return acc + (resolved - created) / (1000 * 60 * 60 * 24); // Convert to days
        }, 0) / resolvedComplaints.length)
      : 0;

    // Get recent activity
    const recentComplaint = await Complaint.findOne().sort({ createdAt: -1 });
    const recentUpdate = await Complaint.findOne().sort({ updatedAt: -1 });
    const recentResolved = await Complaint.findOne({ 
      status: { $in: ['resolved', 'closed'] } 
    }).sort({ updatedAt: -1 });

    // Get user stats
    const totalUsers = await User.countDocuments({ isActive: true });
    const newUsersToday = await User.countDocuments({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    });

    // Calculate efficiency metrics
    const responseRate = Math.round((total > 0 ? (resolved + closed + rejected) / total : 0) * 100);
    const resolutionRate = Math.round((resolvedComplaints.length > 0 ? resolved / resolvedComplaints.length : 0) * 100);

    res.json({
      success: true,
      data: {
        total,
        resolved,
        closed,
        rejected,
        pending,
        inProgress,
        underReview,
        averageResolutionTime: avgResolutionTime,
        responseRate,
        resolutionRate,
        recentActivity: {
          latestComplaint: recentComplaint ? {
            title: recentComplaint.title,
            createdAt: recentComplaint.createdAt
          } : null,
          latestUpdate: recentUpdate ? {
            complaintTitle: recentUpdate.title,
            newStatus: recentUpdate.status,
            updatedAt: recentUpdate.updatedAt
          } : null,
          latestResolved: recentResolved ? {
            complaintTitle: recentResolved.title,
            resolvedAt: recentResolved.resolvedAt
          } : null
        },
        userStats: {
          totalUsers,
          newUsersToday
        }
      }
    });
  } catch (error) {
    console.error('Workflow stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load workflow statistics'
    });
  }
});

module.exports = router;
