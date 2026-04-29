const crypto = require('crypto');
const { authenticator } = require('otplib');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_EXPIRY_SECONDS = Math.floor(OTP_EXPIRY_MS / 1000);
const MAX_OTP_ATTEMPTS = 5;
const OTP_ISSUER = 'BarangayConnect';
const pendingRegistrations = new Map();

authenticator.options = {
  digits: OTP_LENGTH,
  step: 30,
  window: 1
};

const normalizePhoneNumber = (value = '') => {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('63') && digits.length >= 12) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length >= 11) {
    return `+63${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+63${digits}`;
  }

  if (digits.length >= 11 && digits.startsWith('9')) {
    return `+63${digits}`;
  }

  return `+${digits}`;
};

const normalizeAccountLabel = (registrationPayload = {}) => {
  const email = String(registrationPayload.email || '').trim().toLowerCase();
  if (email) {
    return email;
  }

  const phoneNumber = String(registrationPayload.phoneNumber || '').trim();
  if (phoneNumber) {
    return phoneNumber;
  }

  return 'barangayconnect-user';
};

const generateSecret = () => authenticator.generateSecret();

const cleanupExpiredOtps = () => {
  const now = Date.now();
  for (const [verificationId, entry] of pendingRegistrations.entries()) {
    if (entry.expiresAt <= now) {
      pendingRegistrations.delete(verificationId);
    }
  }
};

const cloneRegistrationPayload = (payload) => ({
  ...payload,
  address: payload.address ? { ...payload.address } : {}
});

const createRegistrationOtp = async (registrationPayload) => {
  cleanupExpiredOtps();

  const verificationId = crypto.randomUUID();
  const secret = generateSecret();
  const accountLabel = normalizeAccountLabel(registrationPayload);
  const otpAuthUrl = authenticator.keyuri(accountLabel, OTP_ISSUER, secret);

  const storedPayload = cloneRegistrationPayload({
    ...registrationPayload,
    phoneNumber: normalizePhoneNumber(registrationPayload.phoneNumber) || registrationPayload.phoneNumber
  });

  pendingRegistrations.set(verificationId, {
    secret,
    attempts: 0,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    payload: storedPayload,
    accountLabel
  });

  return {
    verificationId,
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    accountLabel,
    issuer: OTP_ISSUER,
    setupKey: secret,
    otpAuthUrl
  };
};

const verifyRegistrationOtp = (verificationId, otp) => {
  cleanupExpiredOtps();

  const entry = pendingRegistrations.get(verificationId);
  if (!entry) {
    const error = new Error('Verification code expired or invalid');
    error.code = 'OTP_NOT_FOUND';
    throw error;
  }

  if (entry.expiresAt <= Date.now()) {
    pendingRegistrations.delete(verificationId);
    const error = new Error('Verification code expired or invalid');
    error.code = 'OTP_EXPIRED';
    throw error;
  }

  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    pendingRegistrations.delete(verificationId);
    const error = new Error('Too many incorrect attempts. Please request a new code.');
    error.code = 'OTP_LOCKED';
    throw error;
  }

  entry.attempts += 1;

  const normalizedOtp = String(otp || '').trim();

  if (!authenticator.check(normalizedOtp, entry.secret)) {
    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      pendingRegistrations.delete(verificationId);
      const error = new Error('Too many incorrect attempts. Please request a new code.');
      error.code = 'OTP_LOCKED';
      throw error;
    }

    pendingRegistrations.set(verificationId, entry);
    const error = new Error('Incorrect verification code');
    error.code = 'OTP_INVALID';
    throw error;
  }

  pendingRegistrations.delete(verificationId);
  return {
    ...cloneRegistrationPayload(entry.payload),
    authenticatorSecret: entry.secret
  };
};

module.exports = {
  createRegistrationOtp,
  verifyRegistrationOtp,
  normalizePhoneNumber
};