const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { authenticator } = require('otplib');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { protectUser, protectAdmin } = require('../middleware/auth');
const {
  getMailTransport,
  getMailSettingsResponse,
  saveMailSettings,
  testMailSettings
} = require('../services/mailService');
const {
  createRegistrationOtp,
  verifyRegistrationOtp,
  normalizePhoneNumber
} = require('../services/registrationOtpService');

const router = express.Router();
const LOGIN_SETUP_EXPIRY_MS = 10 * 60 * 1000;
const LOGIN_SETUP_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_EXPIRY_MS = 15 * 60 * 1000;
const AUTHENTICATOR_ISSUER = 'BarangayConnect';
const pendingLoginSetups = new Map();
const pendingPasswordResets = new Map();

// Generate JWT Token
const generateToken = (id, isAdmin = false) => {
  return jwt.sign({ id, isAdmin }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

const cleanupExpiredLoginSetups = () => {
  const now = Date.now();
  for (const [verificationId, entry] of pendingLoginSetups.entries()) {
    if (entry.expiresAt <= now) {
      pendingLoginSetups.delete(verificationId);
    }
  }
};

const cleanupExpiredPasswordResets = () => {
  const now = Date.now();
  for (const [verificationId, entry] of pendingPasswordResets.entries()) {
    if (entry.expiresAt <= now) {
      pendingPasswordResets.delete(verificationId);
    }
  }
};

const normalizeResetIdentifier = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.includes('@')) {
    return normalizeEmail(trimmed);
  }

  return normalizePhoneNumber(trimmed);
};

const findUserForReset = async (identifier) => {
  const normalizedIdentifier = normalizeResetIdentifier(identifier);
  if (!normalizedIdentifier) {
    return null;
  }

  if (normalizedIdentifier.includes('@')) {
    return User.findOne({ email: normalizedIdentifier }).select('+password +authenticatorSecret');
  }

  return User.findOne({ phoneNumber: normalizedIdentifier }).select('+password +authenticatorSecret');
};

const createPasswordResetCode = () => String(crypto.randomInt(100000, 1000000));

const hashResetCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const sendPasswordResetEmail = async ({ to, name, code }) => {
  const transport = await getMailTransport();
  if (!transport) {
    return false;
  }

  const settings = await getMailSettingsResponse();

  await transport.sendMail({
    from: settings.smtpFromEmail || process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'BarangayConnect Password Reset Code',
    text: `Hello ${name || 'there'},\n\nYour BarangayConnect password reset code is: ${code}\n\nThis code expires in 15 minutes. If you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin: 0 0 12px; color: #0f172a;">Password Reset Code</h2>
        <p>Hello ${name || 'there'},</p>
        <p>Your BarangayConnect password reset code is:</p>
        <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 16px 20px; background: #f8fafc; border: 1px solid #cbd5e1; display: inline-block; border-radius: 12px;">${code}</div>
        <p style="margin-top: 16px;">This code expires in 15 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `
  });

  return true;
};

const buildLoginSetupLabel = (account, accountType = 'user') => {
  if (account.email) {
    return normalizeEmail(account.email);
  }
  if (account.phoneNumber) {
    return account.phoneNumber;
  }
  return `${accountType}-${account._id}`;
};

const createLoginSetup = (account, accountType = 'user') => {
  cleanupExpiredLoginSetups();

  const verificationId = crypto.randomUUID();
  const secret = authenticator.generateSecret();
  const accountLabel = buildLoginSetupLabel(account, accountType);
  const otpAuthUrl = authenticator.keyuri(accountLabel, AUTHENTICATOR_ISSUER, secret);

  pendingLoginSetups.set(verificationId, {
    accountId: String(account._id),
    accountType,
    secret,
    attempts: 0,
    expiresAt: Date.now() + LOGIN_SETUP_EXPIRY_MS
  });

  return {
    verificationId,
    setupKey: secret,
    otpAuthUrl,
    accountLabel,
    issuer: AUTHENTICATOR_ISSUER,
    expiresInSeconds: Math.floor(LOGIN_SETUP_EXPIRY_MS / 1000)
  };
};

const buildUserResponse = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  address: user.address,
  isVerified: user.isVerified,
  profilePicture: user.profilePicture
});

const buildAdminResponse = (admin) => ({
  id: admin._id,
  firstName: admin.firstName,
  lastName: admin.lastName,
  email: admin.email,
  position: admin.position,
  barangay: admin.barangay,
  permissions: admin.permissions,
  isSuperAdmin: admin.isSuperAdmin
});

const buildRegistrationUserPayload = (payload = {}) => ({
  firstName: payload.firstName,
  middleName: payload.middleName,
  lastName: payload.lastName,
  email: normalizeEmail(payload.email) || undefined,
  password: payload.password,
  phoneNumber: normalizePhoneNumber(payload.phoneNumber) || payload.phoneNumber,
  authenticatorSecret: payload.authenticatorSecret || null,
  address: payload.address,
  profilePicture: payload.profilePicture || null
});

const isExistingEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  return !!existingUser;
};

const createRegisteredUser = async (registrationPayload) => {
  const userPayload = buildRegistrationUserPayload(registrationPayload);

  const user = await User.create({
    ...userPayload,
    isVerified: true
  });

  const token = generateToken(user._id);

  return {
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      address: user.address,
      profilePicture: user.profilePicture,
      isVerified: user.isVerified
    }
  };
};

const buildPasswordResetDebugMessage = (code) =>
  process.env.NODE_ENV === 'production'
    ? null
    : `SMTP is not configured. Use this reset code for testing: ${code}`;

const registrationValidator = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('middleName').optional(),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('address.barangay').notEmpty().withMessage('Barangay is required'),
  body('address.purok').notEmpty().withMessage('Purok is required')
];

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  ...registrationValidator
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (await isExistingEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please log in instead.'
      });
    }

    const { token, user } = await createRegisteredUser(req.body);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Send registration authenticator setup details
// @route   POST /api/auth/register/send-otp
// @access  Public
router.post('/register/send-otp', [
  ...registrationValidator,
  body('confirmPassword').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { password, confirmPassword, email } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (await isExistingEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please log in instead.'
      });
    }

    const {
      verificationId,
      expiresInSeconds,
      accountLabel,
      issuer,
      setupKey,
      otpAuthUrl
    } = await createRegistrationOtp(req.body);

    res.status(200).json({
      success: true,
      message: 'Authenticator setup created successfully',
      data: {
        verificationId,
        expiresInSeconds,
        accountLabel,
        issuer,
        setupKey,
        otpAuthUrl
      }
    });
  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to send verification code'
    });
  }
});

// @desc    Verify registration authenticator code and create account
// @route   POST /api/auth/register/verify-otp
// @access  Public
router.post('/register/verify-otp', [
  body('verificationId').notEmpty().withMessage('Verification ID is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { verificationId, otp } = req.body;
    const registrationPayload = verifyRegistrationOtp(verificationId, otp);

    if (await isExistingEmail(registrationPayload.email)) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please log in instead.'
      });
    }

    const { token, user } = await createRegisteredUser(registrationPayload);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    console.error('Verify registration OTP error:', error);
    const statusCode = error?.code === 'OTP_INVALID' || error?.code === 'OTP_NOT_FOUND' || error?.code === 'OTP_EXPIRED' ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error?.message || 'Failed to verify code'
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('identifier')
    .optional()
    .trim(),
  body('email')
    .optional()
    .trim(),
  body('password').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    const verificationId = String(req.body.verificationId || '').trim();
    const loginIdentifier = String(req.body.identifier || req.body.email || '').trim();

    if (!verificationId && !loginIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required'
      });
    }

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { password, otp } = req.body;

    if (verificationId) {
      cleanupExpiredLoginSetups();

      const setupEntry = pendingLoginSetups.get(verificationId);
      if (!setupEntry || setupEntry.expiresAt <= Date.now()) {
        pendingLoginSetups.delete(verificationId);
        return res.status(400).json({
          success: false,
          message: 'Authenticator setup expired. Please sign in again.'
        });
      }

      const normalizedOtp = String(otp || '').trim();
      if (!/^\d{6}$/.test(normalizedOtp)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid 6-digit authenticator code'
        });
      }

      setupEntry.attempts += 1;
      if (!authenticator.check(normalizedOtp, setupEntry.secret)) {
        if (setupEntry.attempts >= LOGIN_SETUP_MAX_ATTEMPTS) {
          pendingLoginSetups.delete(verificationId);
          return res.status(400).json({
            success: false,
            message: 'Too many incorrect attempts. Please sign in again.'
          });
        }

        pendingLoginSetups.set(verificationId, setupEntry);
        return res.status(401).json({
          success: false,
          message: 'Invalid authenticator code'
        });
      }

      if (setupEntry.accountType === 'admin') {
        const admin = await Admin.findById(setupEntry.accountId).select('+authenticatorSecret');
        if (!admin || !admin.isActive) {
          pendingLoginSetups.delete(verificationId);
          return res.status(401).json({
            success: false,
            message: 'Account is not available'
          });
        }

        if (!admin.authenticatorSecret) {
          admin.authenticatorSecret = setupEntry.secret;
        }

        await admin.resetLoginAttempts();
        await admin.save();
        pendingLoginSetups.delete(verificationId);

        const token = generateToken(admin._id, true);
        return res.json({
          success: true,
          message: 'Admin login successful',
          data: {
            token,
            isAdmin: true,
            admin: buildAdminResponse(admin)
          }
        });
      }

      const user = await User.findById(setupEntry.accountId).select('+authenticatorSecret');
      if (!user || !user.isActive) {
        pendingLoginSetups.delete(verificationId);
        return res.status(401).json({
          success: false,
          message: 'Account is not available'
        });
      }

      if (!user.authenticatorSecret) {
        user.authenticatorSecret = setupEntry.secret;
      }

      user.lastLogin = new Date();
      await user.save();

      pendingLoginSetups.delete(verificationId);

      const token = generateToken(user._id);
      return res.json({
        success: true,
        message: 'User login successful',
        data: {
          token,
          isAdmin: false,
          user: buildUserResponse(user)
        }
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const normalizedEmail = normalizeEmail(loginIdentifier);
    const normalizedPhone = normalizePhoneNumber(loginIdentifier);
    const isEmailLogin = loginIdentifier.includes('@');

    // Check if it's an admin login
    const admin = isEmailLogin ? await Admin.findOne({ email: normalizedEmail }).select('+password +authenticatorSecret') : null;
    if (admin) {
      if (admin.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is locked due to multiple failed login attempts. Try again later.'
        });
      }

      const isMatch = await admin.matchPassword(password);
      if (isMatch) {
        if (!admin.authenticatorSecret) {
          const setup = createLoginSetup(admin, 'admin');
          return res.status(200).json({
            success: false,
            message: 'Admin authenticator setup required',
            data: {
              requiresOtp: true,
              setupRequired: true,
              ...setup
            }
          });
        }

        const normalizedOtp = String(otp || '').trim();
        if (!/^\d{6}$/.test(normalizedOtp)) {
          return res.status(200).json({
            success: false,
            message: 'Authenticator code is required',
            data: {
              requiresOtp: true,
              setupRequired: false
            }
          });
        }

        const otpValid = authenticator.check(normalizedOtp, admin.authenticatorSecret);
        if (!otpValid) {
          return res.status(401).json({
            success: false,
            message: 'Invalid authenticator code',
            data: {
              requiresOtp: true,
              setupRequired: false
            }
          });
        }

        await admin.resetLoginAttempts();
        const token = generateToken(admin._id, true);

        return res.json({
          success: true,
          message: 'Admin login successful',
          data: {
            token,
            isAdmin: true,
            admin: buildAdminResponse(admin)
          }
        });
      } else {
        await admin.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
    }

    // Check if it's a user login
    const userQuery = isEmailLogin
      ? { email: normalizedEmail }
      : { phoneNumber: normalizedPhone || loginIdentifier };
    const user = await User.findOne(userQuery).select('+password +authenticatorSecret');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.authenticatorSecret) {
      const setup = createLoginSetup(user);
      return res.status(200).json({
        success: false,
        message: 'Authenticator setup required',
        data: {
          requiresOtp: true,
          setupRequired: true,
          ...setup
        }
      });
    }

    if (user.authenticatorSecret) {
      const normalizedOtp = String(otp || '').trim();
      if (!/^\d{6}$/.test(normalizedOtp)) {
        return res.status(401).json({
          success: false,
          message: 'Authenticator code is required'
        });
      }

      const otpValid = authenticator.check(normalizedOtp, user.authenticatorSecret);
      if (!otpValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authenticator code'
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'User login successful',
      data: {
        token,
        isAdmin: false,
        user: buildUserResponse(user)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @desc    Request password reset code
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('identifier').notEmpty().withMessage('Email or phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    cleanupExpiredPasswordResets();

    const user = await findUserForReset(req.body.identifier);
    if (!user || !user.isActive) {
      return res.json({
        success: true,
        message: 'If the account exists, a password reset code has been sent.'
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: 'This account does not have an email address on file. Please contact an administrator to reset the password.'
      });
    }

    const resetCode = createPasswordResetCode();
    const hashedResetCode = hashResetCode(resetCode);
    const verificationId = crypto.randomUUID();
    const expiresAt = Date.now() + PASSWORD_RESET_EXPIRY_MS;

    pendingPasswordResets.set(verificationId, {
      userId: String(user._id),
      codeHash: hashedResetCode,
      expiresAt,
      attempts: 0
    });

    user.resetPasswordToken = hashedResetCode;
    user.resetPasswordExpire = new Date(expiresAt);
    await user.save();

    const emailSent = await sendPasswordResetEmail({
      to: user.email,
      name: user.firstName,
      code: resetCode
    });

    res.json({
      success: true,
      message: 'If the account exists, a password reset code has been sent.',
      data: {
        verificationId,
        expiresInSeconds: Math.floor(PASSWORD_RESET_EXPIRY_MS / 1000),
        ...(emailSent ? {} : { debugResetCode: resetCode, debugMessage: buildPasswordResetDebugMessage(resetCode) })
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to create password reset code'
    });
  }
});

// @desc    Reset password using code
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', [
  body('identifier').notEmpty().withMessage('Email or phone number is required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    cleanupExpiredPasswordResets();

    const { identifier, code, newPassword, confirmPassword } = req.body;
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    const user = await findUserForReset(identifier);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code or account not found'
      });
    }

    const pendingEntry = Array.from(pendingPasswordResets.entries()).find(([, entry]) => entry.userId === String(user._id));
    if (!pendingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Reset code expired or invalid'
      });
    }

    const [verificationId, entry] = pendingEntry;
    if (entry.expiresAt <= Date.now()) {
      pendingPasswordResets.delete(verificationId);
      return res.status(400).json({
        success: false,
        message: 'Reset code expired or invalid'
      });
    }

    entry.attempts += 1;
    if (entry.attempts > 5) {
      pendingPasswordResets.delete(verificationId);
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new reset code.'
      });
    }

    if (hashResetCode(code) !== entry.codeHash || user.resetPasswordToken !== entry.codeHash) {
      pendingPasswordResets.set(verificationId, entry);
      return res.status(401).json({
        success: false,
        message: 'Invalid reset code'
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    pendingPasswordResets.delete(verificationId);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to reset password'
    });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          middleName: user.middleName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          isVerified: user.isVerified,
          profilePicture: user.profilePicture,
          createdAt: user.createdAt,
          accountChanges: user.accountChanges || []
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get current admin profile
// @route   GET /api/auth/admin/me
// @access  Private (Admin)
router.get('/admin/me', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    
    res.json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phoneNumber: admin.phoneNumber,
          position: admin.position,
          barangay: admin.barangay,
          department: admin.department,
          permissions: admin.permissions,
          isSuperAdmin: admin.isSuperAdmin,
          profilePicture: admin.profilePicture,
          resolvedComplaints: admin.resolvedComplaints,
          averageResolutionTime: admin.averageResolutionTime
        }
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Change current admin password
// @route   PUT /api/auth/admin/change-password
// @access  Private (Admin)
router.put('/admin/change-password', protectAdmin, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').notEmpty().withMessage('Confirm password is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('Authenticator code must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword, confirmPassword, otp } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    const admin = await Admin.findById(req.admin._id).select('+password +authenticatorSecret');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const isMatch = await admin.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    if (!admin.authenticatorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Authenticator is not set up for this admin account'
      });
    }

    const otpValid = authenticator.check(String(otp || '').trim(), admin.authenticatorSecret);
    if (!otpValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authenticator code'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: 'Admin password changed successfully'
    });
  } catch (error) {
    console.error('Change admin password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing admin password'
    });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
