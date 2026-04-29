const nodemailer = require('nodemailer');
const MailSettings = require('../models/MailSettings');

const SETTINGS_KEY = 'default';

const normalizeSecure = (value, port) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true';
  }

  return Number(port) === 465;
};

const getEnvMailSettings = () => ({
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
  smtpSecure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || ''
});

const getStoredMailSettings = async () => {
  const stored = await MailSettings.findOne({ key: SETTINGS_KEY }).lean();
  if (!stored) {
    return null;
  }

  return stored;
};

const getResolvedMailSettings = async () => {
  const stored = await getStoredMailSettings();
  const env = getEnvMailSettings();

  // If no stored settings, use env vars
  if (!stored) {
    return {
      ...env,
      source: 'env',
      isActive: false,
      configured: !!(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass),
      hasPassword: !!env.smtpPass
    };
  }

  // If stored settings exist but isActive is false, ignore stored and use env vars
  if (stored.isActive === false) {
    return {
      ...env,
      source: 'env',
      isActive: false,
      configured: !!(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass),
      hasPassword: !!env.smtpPass
    };
  }

  // Use stored settings (isActive is true or undefined)
  const resolved = {
    smtpHost: stored.smtpHost || env.smtpHost,
    smtpPort: stored.smtpPort || env.smtpPort,
    smtpSecure: normalizeSecure(stored.smtpSecure, stored.smtpPort || env.smtpPort),
    smtpUser: stored.smtpUser || env.smtpUser,
    smtpPass: stored.smtpPass || env.smtpPass,
    smtpFromEmail: stored.smtpFromEmail || env.smtpFromEmail || stored.smtpUser || env.smtpUser,
    source: 'database',
    isActive: stored.isActive !== false
  };

  return {
    ...resolved,
    configured: !!(resolved.smtpHost && resolved.smtpPort && resolved.smtpUser && resolved.smtpPass),
    hasPassword: !!resolved.smtpPass,
    updatedAt: stored.updatedAt,
    createdAt: stored.createdAt
  };
};

const buildTransportConfig = (settings) => {
  if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass) {
    return null;
  }

  return {
    host: settings.smtpHost,
    port: Number(settings.smtpPort),
    secure: normalizeSecure(settings.smtpSecure, settings.smtpPort),
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass
    }
  };
};

const getMailTransport = async () => {
  const settings = await getResolvedMailSettings();
  const config = buildTransportConfig(settings);

  if (!config) {
    return null;
  }

  return nodemailer.createTransport(config);
};

const getMailSettingsResponse = async () => {
  const settings = await getResolvedMailSettings();

  return {
    key: SETTINGS_KEY,
    smtpHost: settings.smtpHost || '',
    smtpPort: settings.smtpPort || null,
    smtpSecure: !!settings.smtpSecure,
    smtpUser: settings.smtpUser || '',
    smtpFromEmail: settings.smtpFromEmail || '',
    isActive: settings.isActive !== false,
    configured: !!settings.configured,
    source: settings.source,
    hasPassword: !!settings.hasPassword,
    updatedAt: settings.updatedAt || null,
    createdAt: settings.createdAt || null
  };
};

const saveMailSettings = async ({ smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromEmail, isActive, updatedBy }) => {
  const existing = await MailSettings.findOne({ key: SETTINGS_KEY });

  const nextData = {
    key: SETTINGS_KEY,
    smtpHost: smtpHost.trim(),
    smtpPort: Number(smtpPort),
    smtpSecure: normalizeSecure(smtpSecure, smtpPort),
    smtpUser: smtpUser.trim(),
    smtpFromEmail: (smtpFromEmail || smtpUser).trim(),
    isActive: isActive !== false, // Default to true if not specified
    updatedBy: updatedBy || null
  };

  if (smtpPass) {
    nextData.smtpPass = smtpPass;
  } else if (existing?.smtpPass) {
    nextData.smtpPass = existing.smtpPass;
  } else {
    nextData.smtpPass = '';
  }

  const updated = await MailSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: nextData },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  return updated;
};

const testMailSettings = async ({ to, subject, text, html }) => {
  const transport = await getMailTransport();
  if (!transport) {
    return { success: false, message: 'SMTP is not configured' };
  }

  const resolved = await getResolvedMailSettings();
  await transport.sendMail({
    from: resolved.smtpFromEmail || resolved.smtpUser,
    to,
    subject,
    text,
    html
  });

  return { success: true };
};

module.exports = {
  getMailTransport,
  getMailSettingsResponse,
  saveMailSettings,
  testMailSettings
};