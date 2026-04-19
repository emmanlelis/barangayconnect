#!/usr/bin/env node

/**
 * Check actual credentials in database
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkCredentials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔍 Checking credentials in database...\n');
    
    // Check users
    const User = require('./models/User');
    const users = await User.find({});
    console.log('📱 Users in database:');
    users.forEach(user => {
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Password: password123 (if you created this user)`);
    });
    
    // Check admins
    const Admin = require('./models/Admin');
    const admins = await Admin.find({});
    console.log('\n🖥️  Admins in database:');
    admins.forEach(admin => {
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
      console.log(`   Position: ${admin.position}`);
      console.log(`   Password: admin123 (if you created this admin)`);
    });
    
    console.log('\n💡 Try these credentials to login:');
    console.log('   Web Admin: Use any admin email above with password: admin123');
    console.log('   Mobile User: Use any user email above with password: password123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkCredentials();
