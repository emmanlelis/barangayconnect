require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Complaint = require('../models/Complaint');
const Blotter = require('../models/Blotter');
const Notification = require('../models/Notification');

const resetTestData = async () => {
  await connectDB();

  try {
    const [complaintResult, blotterResult, notificationResult] = await Promise.all([
      Complaint.deleteMany({}),
      Blotter.deleteMany({}),
      Notification.deleteMany({})
    ]);

    console.log('Reset complete:');
    console.log(`- Complaints deleted: ${complaintResult.deletedCount}`);
    console.log(`- Blotters deleted: ${blotterResult.deletedCount}`);
    console.log(`- Notifications deleted: ${notificationResult.deletedCount}`);
  } catch (error) {
    console.error('Reset failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

resetTestData();