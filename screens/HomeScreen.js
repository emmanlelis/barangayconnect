import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Image,
  Platform,
  StatusBar,
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

const DashboardStat = ({ title, value, onPress, theme }) => (
  <TouchableOpacity
    style={[styles.statItem, { backgroundColor: theme.background, borderColor: theme.border }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[styles.statAccent, { backgroundColor: theme.accent }]} />
    <Text style={[styles.statNumber, { color: theme.accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{title}</Text>
  </TouchableOpacity>
);

const HomeScreen = ({ navigation }) => {
  const { user, logout, refreshProfile } = useAuth();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshProfile();
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

  const handleNotifications = () => {
    navigation.navigate('Notifications');
  };

  const openStatSection = (section, params = {}) => {
    navigation.navigate(section, params);
  };

  const statCards = stats ? [
    {
      title: 'Blotters',
      value: stats.totalBlotters ?? stats.totalComplaints ?? 0,
      route: 'Status',
      params: { initialFilter: 'All' },
      theme: { background: '#eef4ff', border: '#c9d8ff', accent: '#2457d6' },
    },
    {
      title: 'Pending',
      value: stats.pendingBlotters ?? stats.pendingComplaints ?? 0,
      route: 'Status',
      params: { initialFilter: 'Pending' },
      theme: { background: '#fff4e5', border: '#ffd8a8', accent: '#d97706' },
    },
    {
      title: 'In Progress',
      value: stats.inProgressBlotters ?? stats.inProgressComplaints ?? 0,
      route: 'Status',
      params: { initialFilter: 'In Progress' },
      theme: { background: '#ecfdf3', border: '#bbf7d0', accent: '#15803d' },
    },
    {
      title: 'Closed - Resolved',
      value: stats.closedResolvedBlotters ?? stats.resolvedComplaints ?? 0,
      route: 'Status',
      params: { initialFilter: 'Resolved' },
      theme: { background: '#f5f3ff', border: '#ddd6fe', accent: '#7c3aed' },
    },
    {
      title: 'Closed - No Show',
      value: stats.closedNoShowBlotters ?? 0,
      route: 'Status',
      params: { initialFilter: 'No Show' },
      theme: { background: '#fff1f2', border: '#fecdd3', accent: '#be123c' },
    },
    {
      title: 'My Received Blotter',
      value: stats.receivedBlotters ?? 0,
      route: 'ReceivedBlotter',
      params: { initialStatus: 'All' },
      theme: { background: '#ecfeff', border: '#a5f3fc', accent: '#0891b2' },
    },
    {
      title: 'Lupon ng Tagapamayapa',
      value: stats.luponBlotters ?? 0,
      route: 'ReceivedBlotter',
      params: { initialStatus: 'lupon' },
      theme: { background: '#fff7ed', border: '#fed7aa', accent: '#ea580c' },
    },
  ] : [];

  const getProfileImage = () => {
    if (user?.profilePicture) {
      return { uri: user.profilePicture };
    }
    return null;
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
            <Image
              source={require('../assets/BarangayConnect Logo.png')}
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Welcome back, {user?.firstName}!</Text>
            <View style={styles.miniProfileWrap}>
              {getProfileImage() ? (
                <Image source={getProfileImage()} style={styles.miniProfileImage} />
              ) : (
                <View style={styles.miniProfilePlaceholder}>
                  <Text style={styles.miniProfileInitials}>
                    {user?.firstName?.[0] || ''}{user?.lastName?.[0] || ''}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleNotifications} style={styles.notificationButton} activeOpacity={0.8}>
            <Text style={styles.notificationIcon}>🔔</Text>
            {!!stats?.unreadNotifications && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {stats.unreadNotifications > 99 ? '99+' : stats.unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        {stats && (
          <View style={styles.statsContainer}>
            {statCards.map((item) => (
              <DashboardStat
                key={item.title}
                title={item.title}
                value={item.value}
                onPress={() => openStatSection(item.route, item.params)}
                theme={item.theme}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.dashboardContainer}>
        <Text style={styles.sectionTitle}>Menu</Text>
        
        <View style={styles.tilesWrapper}>
          <View style={styles.tileColumn}>
            <DashboardTile
              title="Submit Blotter"
              description="Report issues or concerns"
              icon="📝"
              color="#007AFF"
              onPress={() => navigation.navigate('Blotter')}
            />
            
            <DashboardTile
              title="Track Status"
              description="Check progress of submissions"
              icon="📊"
              color="#34C759"
              onPress={() => navigation.navigate('Status')}
            />
          </View>

          <View style={styles.tileColumn}>
            <DashboardTile
              title="My Received Blotters"
              description="View summaries filed against you"
              icon="📨"
              color="#5856D6"
              onPress={() => navigation.navigate('ReceivedBlotter')}
            />
            
            <DashboardTile
              title="My Profile"
              description="Manage your account"
              icon="👤"
              color="#FF9500"
              onPress={() => navigation.navigate('Profile')}
            />
          </View>
        </View>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 20,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  appLogo: {
    width: 170,
    height: 58,
    marginBottom: 6,
    marginLeft: -26,
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
  miniProfileWrap: {
    marginTop: 10,
  },
  miniProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6e4ff',
  },
  miniProfilePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#e8f0ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d6e4ff',
  },
  miniProfileInitials: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f5fd3',
  },
  notificationButton: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notificationIcon: {
    fontSize: 18,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 14,
  },
  statItem: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 92,
    justifyContent: 'center',
  },
  statAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 13,
    color: '#51606f',
    textTransform: 'uppercase',
    textAlign: 'center',
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
  tilesWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tileColumn: {
    flex: 1,
    marginHorizontal: 6,
  },
  tile: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tileIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    color: '#fff',
    lineHeight: 20,
  },
  tileDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: '#fff',
    opacity: 0.85,
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
