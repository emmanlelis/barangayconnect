const ADDRESS_FIELDS = ['street', 'purok', 'barangay', 'city', 'province', 'zipCode'];

const formatValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const collectFieldChanges = (beforeUser, afterUser) => {
  const changes = [];

  const compareField = (field, label) => {
    if (beforeUser?.[field] !== afterUser?.[field]) {
      changes.push({
        field,
        label,
        before: formatValue(beforeUser?.[field]),
        after: formatValue(afterUser?.[field])
      });
    }
  };

  compareField('firstName', 'First name');
  compareField('middleName', 'Middle name');
  compareField('lastName', 'Last name');
  compareField('email', 'Email');
  compareField('phoneNumber', 'Phone number');
  compareField('profilePicture', 'Profile picture');

  ADDRESS_FIELDS.forEach((field) => {
    if ((beforeUser?.address?.[field] || '') !== (afterUser?.address?.[field] || '')) {
      changes.push({
        field: `address.${field}`,
        label: `Address ${field}`,
        before: formatValue(beforeUser?.address?.[field]),
        after: formatValue(afterUser?.address?.[field])
      });
    }
  });

  return changes;
};

const buildAccountChangeLog = ({ beforeUser, afterUser, actorType, actorId, source }) => {
  const changes = collectFieldChanges(beforeUser, afterUser);

  if (changes.length === 0) {
    return null;
  }

  return {
    action: 'profile_updated',
    source,
    actorType,
    actorId,
    changedFields: changes.map((change) => change.field),
    changes,
    createdAt: new Date()
  };
};

module.exports = {
  buildAccountChangeLog
};