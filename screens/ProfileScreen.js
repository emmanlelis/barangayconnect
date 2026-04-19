import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

const ProfileScreen = ({ navigation }) => {
  const { user, logout, refreshProfile } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const response = await userAPI.getStats();
      if (response.success) {
        setStats(response.data.statistics);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

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

  const handleMenuPress = (action) => {
    switch (action) {
      case 'complaints':
        navigation.navigate('Status');
        break;
      case 'notifications':
        Alert.alert('Notifications', 'Notification feature coming soon!');
        break;
      case 'settings':
        Alert.alert('Settings', 'Settings feature coming soon!');
        break;
      case 'support':
        Alert.alert('Contact Support', 'support@barangayconnect.com');
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Manage your account</Text>
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
          <Text style={styles.profileName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <Text style={styles.profilePhone}>{user?.phoneNumber}</Text>
          <Text style={styles.profileAddress}>
            {user?.address?.barangay}, {user?.address?.city || 'City'}
          </Text>
        </View>

        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalComplaints}</Text>
              <Text style={styles.statLabel}>Complaints Filed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.resolvedComplaints}</Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.inProgressComplaints}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
          </View>
        )}

        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuPress('complaints')}
          >
            <Text style={styles.menuText}>📝 My Complaints</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuPress('notifications')}
          >
            <Text style={styles.menuText}>🔔 Notifications</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuPress('settings')}
          >
            <Text style={styles.menuText}>⚙️ Settings</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuPress('support')}
          >
            <Text style={styles.menuText}>📞 Contact Support</Text>
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

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
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
  },
  backButton: {
    marginBottom: 10,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
    color: '#666',
  },
  menuContainer: {
    gap: 1,
    marginBottom: 30,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
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
});

export default ProfileScreen;
