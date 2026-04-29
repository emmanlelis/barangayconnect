const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');

const normalizeId = (value) => (value ? value.toString() : null);

const uniqueIds = (values = []) => [...new Set(values.map(normalizeId).filter(Boolean))];

const createNotification = async ({ recipient, type, title, message, metadata = {} }) => {
  if (!recipient) {
    return null;
  }

  return Notification.create({
    recipient,
    type,
    title,
    message,
    metadata
  });
};

const createNotifications = async (recipients = [], payload) => {
  const recipientIds = uniqueIds(recipients);

  if (recipientIds.length === 0) {
    return [];
  }

  return Promise.all(recipientIds.map((recipient) => createNotification({ recipient, ...payload })));
};

const resolveBlotterRecipients = async (blotter) => {
  const recipients = [];

  if (blotter?.sourceComplaint) {
    const complaint = await Complaint.findById(blotter.sourceComplaint).select('user');
    if (complaint?.user) {
      recipients.push(complaint.user);
    }
  }

  if (blotter?.complainantUser) {
    recipients.push(blotter.complainantUser);
  }

  if (blotter?.defendantUser) {
    recipients.push(blotter.defendantUser);
  }

  return uniqueIds(recipients);
};

const getBlotterReference = (blotter) => blotter?.caseNumber || blotter?._id?.toString() || 'your blotter';

const getSubmissionNotification = (blotter) => ({
  type: 'blotter_submitted',
  title: 'Blotter Submitted',
  message: `Your blotter has been submitted successfully. Blotter ID: ${getBlotterReference(blotter)}.`,
  metadata: {
    blotterId: normalizeId(blotter?._id),
    caseNumber: blotter?.caseNumber || null,
    complaintId: normalizeId(blotter?.sourceComplaint)
  }
});

const getReceivedNotification = (blotter) => ({
  type: 'blotter_received',
  title: 'New Blotter Received',
  message: `A blotter case has been filed against your account. Blotter ID: ${getBlotterReference(blotter)}.`,
  metadata: {
    blotterId: normalizeId(blotter?._id),
    caseNumber: blotter?.caseNumber || null,
    complaintId: normalizeId(blotter?.sourceComplaint)
  }
});

const getStatusNotification = (blotter) => {
  const reference = getBlotterReference(blotter);

  switch (blotter?.status) {
    case 'ongoing-no-mediation':
      return {
        type: 'blotter_visit_scheduled',
        title: 'Visit Scheduled',
        message: `A visit has been scheduled for blotter ${reference}.`
      };
    case 'ongoing':
      return {
        type: 'blotter_mediation_1_scheduled',
        title: '1st Mediation Scheduled',
        message: `The 1st mediation has been scheduled for blotter ${reference}.`
      };
    case 'ongoing-2nd':
      return {
        type: 'blotter_mediation_2_scheduled',
        title: '2nd Mediation Scheduled',
        message: `The 2nd mediation has been scheduled for blotter ${reference}.`
      };
    case 'ongoing-3rd':
      return {
        type: 'blotter_mediation_3_scheduled',
        title: '3rd Mediation Scheduled',
        message: `The 3rd mediation has been scheduled for blotter ${reference}.`
      };
    case 'lupon':
      return {
        type: 'blotter_lupon',
        title: 'Endorsed to Lupon ng Tagapamayapa',
        message: `Your blotter has been endorsed to Lupon ng Tagapamayapa. Blotter ID: ${reference}.`
      };
    case 'resolved':
      return {
        type: 'blotter_resolved',
        title: 'Blotter Closed - Resolved',
        message: `Your blotter has been closed as resolved. Blotter ID: ${reference}.`
      };
    case 'no-show':
      return {
        type: 'blotter_no_show',
        title: 'Blotter Closed - No Show',
        message: `Your blotter has been closed as no show. Blotter ID: ${reference}.`
      };
    default:
      return {
        type: 'blotter_update',
        title: 'Blotter Updated',
        message: `There is an update on blotter ${reference}.`
      };
  }
};

const getAccountUpdateNotification = (kind) => {
  if (kind === 'password_changed') {
    return {
      type: 'password_changed',
      title: 'Password Changed',
      message: 'Your password was changed successfully.'
    };
  }

  return {
    type: 'profile_updated',
    title: 'Account Updated',
    message: 'Your account details were updated successfully.'
  };
};

module.exports = {
  createNotification,
  createNotifications,
  resolveBlotterRecipients,
  getSubmissionNotification,
  getReceivedNotification,
  getStatusNotification,
  getAccountUpdateNotification
};