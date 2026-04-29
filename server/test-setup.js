#!/usr/bin/env node

/**
 * BarangayConnect Setup Test Script
 * Run this script to verify your backend setup is working correctly
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Admin = require('./models/Admin');
require('dotenv').config();

const testResults = {
  database: false,
  userCreation: false,
  adminCreation: false,
  overall: false
};

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connection successful');
    testResults.database = true;
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('💡 Make sure MongoDB is running and MONGODB_URI is correct in .env');
    return false;
  }
}

async function testUserCreation() {
  console.log('\n🔍 Testing user creation...');
  try {
    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@barangayconnect.com' });
    if (existingUser) {
      console.log('✅ Test user already exists');
      testResults.userCreation = true;
      return true;
    }

    // Create test user
    const testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@barangayconnect.com',
      password: 'password123',
      phoneNumber: '09123456789',
      address: {
        barangay: 'Test Barangay',
        city: 'Test City'
      }
    });

    console.log('✅ Test user created successfully');
    console.log(`   ID: ${testUser._id}`);
    console.log(`   Email: ${testUser.email}`);
    testResults.userCreation = true;
    return true;
  } catch (error) {
    console.log('❌ User creation failed:', error.message);
    return false;
  }
}

async function testAdminCreation() {
  console.log('\n🔍 Testing admin creation...');
  try {
    // Check if test admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@barangayconnect.com' });
    if (existingAdmin) {
      if (existingAdmin.position !== 'Barangay Secretary') {
        existingAdmin.position = 'Barangay Secretary';
        await existingAdmin.save();
        console.log('✅ Existing test admin position updated to Barangay Secretary');
      }
      console.log('✅ Test admin already exists');
      testResults.adminCreation = true;
      return true;
    }

    // Create test admin
    const testAdmin = await Admin.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@barangayconnect.com',
      password: 'admin123',
      phoneNumber: '09987654321',
      position: 'Barangay Secretary',
      barangay: 'Test Barangay',
      department: 'General Administration',
      permissions: ['view_complaints', 'manage_complaints', 'admin_panel'],
      isSuperAdmin: true,
      isActive: true
    });

    console.log('✅ Test admin created successfully');
    console.log(`   ID: ${testAdmin._id}`);
    console.log(`   Email: ${testAdmin.email}`);
    console.log(`   Position: ${testAdmin.position}`);
    testResults.adminCreation = true;
    return true;
  } catch (error) {
    console.log('❌ Admin creation failed:', error.message);
    return false;
  }
}

async function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables...');
  
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missingVars = [];

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 Please add these to your .env file');
    return false;
  } else {
    console.log('✅ All required environment variables are set');
    return true;
  }
}

async function printTestCredentials() {
  console.log('\n🔑 Test Credentials Created:');
  console.log('\n📱 Mobile App User:');
  console.log('   Email: test@barangayconnect.com');
  console.log('   Password: password123');
  
  console.log('\n🖥️  Web Admin:');
  console.log('   Email: admin@barangayconnect.com');
  console.log('   Password: admin123');
  
  console.log('\n🌐 API Endpoints:');
  console.log('   Health Check: http://localhost:5000/api/health');
  console.log('   User Login: POST http://localhost:5000/api/auth/login');
  console.log('   Admin Dashboard: GET http://localhost:5000/api/admin/dashboard');
}

async function main() {
  console.log('🚀 BarangayConnect Setup Test');
  console.log('================================\n');

  // Check environment variables first
  const envOk = await checkEnvironmentVariables();
  if (!envOk) {
    process.exit(1);
  }

  // Test database connection
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    process.exit(1);
  }

  // Test user creation
  await testUserCreation();

  // Test admin creation
  await testAdminCreation();

  // Calculate overall result
  testResults.overall = testResults.database && testResults.userCreation && testResults.adminCreation;

  // Print final results
  console.log('\n📊 Test Results:');
  console.log('================================');
  console.log(`Database Connection: ${testResults.database ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`User Creation: ${testResults.userCreation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Admin Creation: ${testResults.adminCreation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Overall: ${testResults.overall ? '✅ PASS' : '❌ FAIL'}`);

  if (testResults.overall) {
    console.log('\n🎉 Setup test completed successfully!');
    await printTestCredentials();
    console.log('\n📋 Next Steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Test the mobile app: npm start (from project root)');
    console.log('3. Test the web interface: cd web && npm start');
    console.log('4. Follow the TESTING.md guide for comprehensive testing');
  } else {
    console.log('\n❌ Setup test failed. Please fix the issues above and try again.');
    process.exit(1);
  }

  await mongoose.disconnect();
}

// Run the test
main().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
