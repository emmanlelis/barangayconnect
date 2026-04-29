import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { notificationAPI } from '../services/api';

const getNotificationAccent = (type) => {
  switch (type) {
    case 'blotter_submitted':
      return { color: '#2563eb', icon: '📝' };
    case 'blotter_received':
      return { color: '#7c3aed', icon: '📨' };
    case 'blotter_visit_scheduled':
    case 'blotter_mediation_1_scheduled':
    case 'blotter_mediation_2_scheduled':
    case 'blotter_mediation_3_scheduled':
      return { color: '#f59e0b', icon: '📅' };
    case 'blotter_lupon':
      return { color: '#0f766e', icon: '🏛️' };
    case 'blotter_resolved':
      return { color: '#16a34a', icon: '✅' };
    case 'blotter_no_show':
      return { color: '#dc2626', icon: '⚠️' };
    case 'profile_updated':
      return { color: '#0ea5e9', icon: '👤' };
    case 'password_changed':
      return { color: '#111827', icon: '🔐' };
    default:
      return { color: '#475569', icon: '🔔' };
  }
};

const getNotificationRoute = (item) => {
  switch (item?.type) {
    case 'blotter_received':
      return 'ReceivedBlotter';
    case 'blotter_submitted':
    case 'blotter_visit_scheduled':
    case 'blotter_mediation_1_scheduled':
    case 'blotter_mediation_2_scheduled':
    case 'blotter_mediation_3_scheduled':
    case 'blotter_lupon':
    case 'blotter_resolved':
    case 'blotter_no_show':
      return 'Status';
    case 'profile_updated':
    case 'password_changed':
      return 'Profile';
    default:
      return 'Home';
  }
};

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationAPI.getMyNotifications();
      if (response.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      } else {
        Alert.alert('Error', response.message || 'Failed to load notifications');
      }
    } catch (error) {
      console.error('Load notifications error:', error);
      Alert.alert('Error', error?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error('Mark notification read error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      await loadNotifications();
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      Alert.alert('Error', error?.message || 'Failed to mark all as read');
    }
  };

  const handlePress = async (item) => {
    if (!item.isRead) {
      await markAsRead(item._id);
    }

    navigation.navigate(getNotificationRoute(item));
  };

  const renderNotification = (item) => {
    const accent = getNotificationAccent(item.type);

    return (
      <TouchableOpacity
        key={item._id}
        style={[styles.card, !item.isRead && styles.unreadCard]}
        activeOpacity={0.85}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.iconWrap, { backgroundColor: accent.color }]}> 
          <Text style={styles.iconText}>{accent.icon}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardMessage}>{item.message}</Text>
          <Text style={styles.cardDate}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Updates from your blotters and account</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goHome()} style={styles.homeButton} activeOpacity={0.8}>
            <Text style={styles.homeText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{notifications.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, unreadCount === 0 && styles.actionButtonDisabled]}
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <Text style={styles.actionButtonText}>Mark All Read</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              When your blotter is submitted, updated, or assigned, it will appear here.
            </Text>
          </View>
        ) : (
          notifications.map(renderNotification)
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fb',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  actionsRow: {
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  actionButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  unreadCard: {
    backgroundColor: '#f8fbff',
    borderColor: '#cfe0ff',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  cardMessage: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#374151',
  },
  cardDate: {
    marginTop: 8,
    fontSize: 11,
    color: '#94a3b8',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
});

export default NotificationsScreen;