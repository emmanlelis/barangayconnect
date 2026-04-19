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
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';

const DashboardTile = ({ title, count, subtitle, color, onPress }) => (
  <TouchableOpacity
    style={[styles.tile, { backgroundColor: color }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={styles.tileNumber}>{count}</Text>
    <Text style={styles.tileTitle}>{title}</Text>
    <Text style={styles.tileSubtitle}>{subtitle}</Text>
  </TouchableOpacity>
);

const AdminDashboardScreen = ({ navigation }) => {
  const { user: admin } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await adminAPI.getDashboard();
      if (response.success) {
        setDashboardData(response.data);
      } else {
        Alert.alert('Error', response.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Dashboard error:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
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
            const { logout } = useAuth();
            const result = await logout();
            if (!result.success) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  if (isLoading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const stats = dashboardData?.statistics || {};
  const recentComplaints = dashboardData?.recentComplaints || [];

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
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              Welcome, {admin?.firstName}! ({admin?.position})
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <DashboardTile
          title="Total"
          count={stats.totalComplaints || 0}
          subtitle="All complaints"
          color="#007AFF"
          onPress={() => navigation.navigate('AdminComplaints', { status: null })}
        />
        
        <DashboardTile
          title="Pending"
          count={stats.pendingComplaints || 0}
          subtitle="Need attention"
          color="#FF9500"
          onPress={() => navigation.navigate('AdminComplaints', { status: 'Pending' })}
        />
        
        <DashboardTile
          title="In Progress"
          count={stats.inProgressComplaints || 0}
          subtitle="Being handled"
          color="#34C759"
          onPress={() => navigation.navigate('AdminComplaints', { status: 'In Progress' })}
        />
        
        <DashboardTile
          title="Resolved"
          count={stats.resolvedComplaints || 0}
          subtitle="Completed"
          color="#5856D6"
          onPress={() => navigation.navigate('AdminComplaints', { status: 'Resolved' })}
        />
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Recent Complaints</Text>
        {recentComplaints.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recent complaints</Text>
          </View>
        ) : (
          recentComplaints.slice(0, 5).map((complaint) => (
            <TouchableOpacity
              key={complaint._id}
              style={styles.recentComplaintCard}
              onPress={() => navigation.navigate('AdminComplaintDetail', { id: complaint._id })}
            >
              <View style={styles.recentComplaintHeader}>
                <Text style={styles.recentComplaintTitle} numberOfLines={1}>
                  {complaint.title}
                </Text>
                <Text style={[
                  styles.recentComplaintStatus,
                  { backgroundColor: getStatusColor(complaint.status) }
                ]}>
                  {complaint.status}
                </Text>
              </View>
              <View style={styles.recentComplaintFooter}>
                <Text style={styles.recentComplaintCategory}>{complaint.category}</Text>
                <Text style={styles.recentComplaintDate}>
                  {formatDate(complaint.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        
        {recentComplaints.length > 0 && (
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('AdminComplaints')}
          >
            <Text style={styles.viewAllText}>View All Complaints</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('AdminComplaints')}
        >
          <Text style={styles.actionButtonIcon}>📋</Text>
          <Text style={styles.actionButtonText}>Manage All Complaints</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('AdminUsers')}
        >
          <Text style={styles.actionButtonIcon}>👥</Text>
          <Text style={styles.actionButtonText}>Manage Users</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Resolved': return '#34C759';
    case 'In Progress': return '#FF9500';
    case 'Under Review': return '#007AFF';
    case 'Closed': return '#8E8E93';
    case 'Rejected': return '#FF3B30';
    default: return '#007AFF';
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
    fontSize: 28,
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
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  tile: {
    borderRadius: 16,
    padding: 20,
    width: '47%',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tileNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  tileSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  recentComplaintCard: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  recentComplaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentComplaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 12,
  },
  recentComplaintStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recentComplaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentComplaintCategory: {
    fontSize: 12,
    color: '#666',
  },
  recentComplaintDate: {
    fontSize: 12,
    color: '#666',
  },
  viewAllButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  viewAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
});

export default AdminDashboardScreen;
