import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

const emptyEditValues = (user) => ({
  firstName: user?.firstName || '',
  middleName: user?.middleName || '',
  lastName: user?.lastName || '',
  email: user?.email || '',
  phoneNumber: user?.phoneNumber || '',
  street: user?.address?.street || '',
  purok: user?.address?.purok || '',
  barangay: user?.address?.barangay || '',
  city: user?.address?.city || '',
  province: user?.address?.province || '',
  zipCode: user?.address?.zipCode || '',
});

const ProfileField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }) => (
  <View style={styles.fieldBlock}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9aa4b2"
      keyboardType={keyboardType}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

const formatChangeTime = (value) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const ProfileScreen = ({ navigation }) => {
  const { user, logout, refreshProfile, isDarkMode } = useAuth();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editValues, setEditValues] = useState(() => emptyEditValues(user));

  useEffect(() => {
    console.log('ProfileScreen: useEffect mounted, user:', user?._id);
    // Don't call refreshProfile here - it can cause issues
    // The user data is already loaded from AuthContext
  }, []);

  useEffect(() => {
    setEditValues(emptyEditValues(user));
  }, [user]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (!result.success) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const openEditProfile = () => {
    setEditValues(emptyEditValues(user));
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editValues.firstName.trim() || !editValues.lastName.trim() || !editValues.phoneNumber.trim() || !editValues.barangay.trim()) {
      Alert.alert('Missing information', 'First name, last name, phone number, and barangay are required.');
      return;
    }

    setSavingProfile(true);
    try {
      const response = await userAPI.updateProfile({
        firstName: editValues.firstName.trim(),
        middleName: editValues.middleName.trim(),
        lastName: editValues.lastName.trim(),
        email: editValues.email.trim() || undefined,
        phoneNumber: editValues.phoneNumber.trim(),
        address: {
          street: editValues.street.trim(),
          purok: editValues.purok.trim(),
          barangay: editValues.barangay.trim(),
          city: editValues.city.trim(),
          province: editValues.province.trim(),
          zipCode: editValues.zipCode.trim(),
        },
      });

      if (response.success) {
        await refreshProfile();
        setEditModalVisible(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMenuPress = (action) => {
    switch (action) {
      case 'editProfile':
        openEditProfile();
        break;
      case 'about':
        Alert.alert(
          'About',
          'Barangay Connect v1.0.0\n\nYour community service platform for reporting and tracking barangay issues.'
        );
        break;
      default:
        break;
    }
  };

  const getProfileImage = () => {
    if (user?.profilePicture) {
      return { uri: user.profilePicture };
    }
    return null;
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
      </View>
    );
  }

  const colors = isDarkMode
    ? {
        background: '#0f172a',
        text: '#ffffff',
        subtitle: '#94a3b8',
        muted: '#9aa4b2',
        card: '#0b1220',
        border: '#1f2937',
      }
    : {
        background: '#ffffff',
        text: '#1a1a1a',
        subtitle: '#666666',
        muted: '#9aa4b2',
        card: '#ffffff',
        border: '#e7ecf4',
      };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Profile</Text>
        <Text style={[styles.subtitle, { color: colors.subtitle }]}>Manage your account</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goHome()} style={styles.homeButton} activeOpacity={0.8}>
            <Text style={styles.homeText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.profileContainer}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {getProfileImage() ? (
              <Image source={getProfileImage()} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}> {user?.firstName} {user?.lastName}</Text>
          <Text style={[styles.profileEmail, { color: colors.subtitle }]}>{user?.email}</Text>
          <Text style={[styles.profilePhone, { color: colors.subtitle }]}>{user?.phoneNumber}</Text>
          <Text style={[styles.profileAddress, { color: colors.subtitle }]}> {user?.address?.barangay}, {user?.address?.city || 'City'}</Text>
        </View>

        <TouchableOpacity style={styles.editButton} onPress={openEditProfile} activeOpacity={0.85}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuPress('editProfile')}
          >
            <Text style={styles.menuText}>✏️ Edit Profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuPress('about')}
          >
            <Text style={styles.menuText}>ℹ️ About</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Account Changes Logs</Text>
          {(user?.accountChanges || []).length === 0 ? (
            <View style={styles.emptyLogsCard}>
              <Text style={styles.emptyLogsTitle}>No changes logged yet</Text>
              <Text style={styles.emptyLogsText}>
                Updates to your profile will appear here after you save changes.
              </Text>
            </View>
          ) : (
            (user?.accountChanges || []).slice(0, 10).map((log, index) => (
              <View key={`${log.createdAt || index}-${index}`} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logTitle}>Profile updated</Text>
                  <Text style={styles.logTime}>{formatChangeTime(log.createdAt)}</Text>
                </View>
                <Text style={styles.logSummary}>
                  {Array.isArray(log.changes) && log.changes.length > 0
                    ? log.changes.map((item) => item.label).join(', ')
                    : 'Account details were changed.'}
                </Text>
                {Array.isArray(log.changes) && log.changes.length > 0 && (
                  <View style={styles.logChangesList}>
                    {log.changes.slice(0, 4).map((item) => (
                      <View key={`${item.field}-${item.label}`} style={styles.logChangeRow}>
                        <Text style={styles.logChangeLabel}>{item.label}</Text>
                        <Text style={styles.logChangeValue}>{item.before} → {item.after}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <ProfileField label="First Name" value={editValues.firstName} onChangeText={(text) => setEditValues((prev) => ({ ...prev, firstName: text }))} placeholder="First name" />
              <ProfileField label="Middle Name" value={editValues.middleName} onChangeText={(text) => setEditValues((prev) => ({ ...prev, middleName: text }))} placeholder="Middle name" />
              <ProfileField label="Last Name" value={editValues.lastName} onChangeText={(text) => setEditValues((prev) => ({ ...prev, lastName: text }))} placeholder="Last name" />
              <ProfileField label="Email" value={editValues.email} onChangeText={(text) => setEditValues((prev) => ({ ...prev, email: text }))} placeholder="Email address" keyboardType="email-address" />
              <ProfileField label="Phone Number" value={editValues.phoneNumber} onChangeText={(text) => setEditValues((prev) => ({ ...prev, phoneNumber: text }))} placeholder="Phone number" keyboardType="phone-pad" />
              <ProfileField label="Street" value={editValues.street} onChangeText={(text) => setEditValues((prev) => ({ ...prev, street: text }))} placeholder="Street" />
              <ProfileField label="Purok" value={editValues.purok} onChangeText={(text) => setEditValues((prev) => ({ ...prev, purok: text }))} placeholder="Purok" />
              <ProfileField label="Barangay" value={editValues.barangay} onChangeText={(text) => setEditValues((prev) => ({ ...prev, barangay: text }))} placeholder="Barangay" />
              <ProfileField label="City" value={editValues.city} onChangeText={(text) => setEditValues((prev) => ({ ...prev, city: text }))} placeholder="City" />
              <ProfileField label="Province" value={editValues.province} onChangeText={(text) => setEditValues((prev) => ({ ...prev, province: text }))} placeholder="Province" />
              <ProfileField label="Zip Code" value={editValues.zipCode} onChangeText={(text) => setEditValues((prev) => ({ ...prev, zipCode: text }))} placeholder="Zip code" keyboardType="numeric" />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)} activeOpacity={0.8}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} activeOpacity={0.85}>
                  {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 14,
    zIndex: 20,
    elevation: 20,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    color: '#666',
  },
  profileContainer: {
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  profileEmail: {
    fontSize: 14,
    opacity: 0.7,
    color: '#666',
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    opacity: 0.7,
    color: '#666',
    marginBottom: 4,
  },
  profileAddress: {
    fontSize: 14,
    opacity: 0.7,
    color: '#666',
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: '#1f5fd3',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#1f5fd3',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  menuContainer: {
    gap: 1,
    marginBottom: 18,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e7ecf4',
  },
  menuText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  menuArrow: {
    fontSize: 20,
    opacity: 0.5,
    color: '#666',
  },
  logsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15202b',
    marginBottom: 12,
  },
  emptyLogsCard: {
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6ebf2',
  },
  emptyLogsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  emptyLogsText: {
    fontSize: 13,
    color: '#667085',
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e6ebf2',
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15202b',
    flex: 1,
  },
  logTime: {
    fontSize: 12,
    color: '#667085',
    textAlign: 'right',
  },
  logSummary: {
    fontSize: 13,
    color: '#344054',
    marginBottom: 10,
    lineHeight: 18,
  },
  logChangesList: {
    gap: 8,
  },
  logChangeRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
  },
  logChangeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#344054',
    marginBottom: 3,
  },
  logChangeValue: {
    fontSize: 12,
    color: '#475467',
    lineHeight: 16,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '92%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#15202b',
    marginBottom: 14,
  },
  modalScrollContent: {
    paddingBottom: 18,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 6,
  },
  fieldInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d7dfeb',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f9fbfd',
    color: '#15202b',
  },
  fieldInputMultiline: {
    minHeight: 54,
    paddingTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#eef2f7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#344054',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1f5fd3',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default ProfileScreen;
