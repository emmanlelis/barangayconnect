import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

const DashboardTile = ({ title, description, icon, color, onPress }) => (
  <TouchableOpacity
    style={[styles.tile, { backgroundColor: color }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={styles.tileIcon}>{icon}</Text>
    <Text style={styles.tileTitle}>{title}</Text>
    <Text style={styles.tileDescription}>{description}</Text>
  </TouchableOpacity>
);

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserStats();
    setRefreshing(false);
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Barangay Connect</Text>
            <Text style={styles.subtitle}>Welcome back, {user?.firstName}!</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
        
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalComplaints}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.inProgressComplaints}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.resolvedComplaints}</Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.dashboardContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <DashboardTile
          title="Submit Complaint"
          description="Report issues or concerns to your barangay"
          icon="📝"
          color="#007AFF"
          onPress={() => navigation.navigate('Complaint')}
        />
        
        <DashboardTile
          title="Track Status"
          description="Check the progress of your submitted complaints"
          icon="📊"
          color="#34C759"
          onPress={() => navigation.navigate('Status')}
        />
        
        <DashboardTile
          title="My Profile"
          description="Manage your account and preferences"
          icon="👤"
          color="#FF9500"
          onPress={() => navigation.navigate('Profile')}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Serving your community, one issue at a time</Text>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
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
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  dashboardContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  tile: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tileIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#fff',
  },
  tileDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#fff',
    opacity: 0.9,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    color: '#666',
  },
});

export default HomeScreen;
