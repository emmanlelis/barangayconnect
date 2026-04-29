import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { adminAPI } from '../../services/api';

const AdminBlottersScreen = ({ navigation, route }) => {
  const [complaints, setComplaints] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState(route.params?.status || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const filters = ['All', 'Pending', 'In Progress', 'Under Review', 'Resolved', 'Closed', 'Rejected'];

  useEffect(() => {
    loadComplaints(true);
  }, [selectedFilter, searchQuery]);

  const loadComplaints = async (reset = false) => {
    if (reset) {
      setPage(1);
      setHasMore(true);
    }
    
    setIsLoading(true);
    try {
      const filters = {
        status: selectedFilter === 'All' ? undefined : selectedFilter,
        search: searchQuery || undefined,
        page: reset ? 1 : page,
        limit: 20,
      };

      const response = await adminAPI.getComplaints(filters);
      
      if (response.success) {
        const newComplaints = response.data.complaints;
        if (reset) {
          setComplaints(newComplaints);
        } else {
          setComplaints(prev => [...prev, ...newComplaints]);
        }
        setHasMore(response.data.pagination.hasNext);
        if (!reset) {
          setPage(prev => prev + 1);
        }
      } else {
        Alert.alert('Error', response.message || 'Failed to load blotters');
      }
    } catch (error) {
      console.error('Load blotters error:', error);
      Alert.alert('Error', 'Failed to load blotters');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadComplaints(true);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadComplaints(false);
    }
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return '#FF3B30';
      case 'High': return '#FF9500';
      case 'Medium': return '#FFCC02';
      case 'Low': return '#34C759';
      default: return '#8E8E93';
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

  const handleComplaintPress = (complaint) => {
    navigation.navigate('AdminBlotterDetail', { id: complaint._id });
  };

  const handleStatusUpdate = async (complaintId, newStatus) => {
    try {
      const response = await adminAPI.updateComplaintStatus(complaintId, {
        status: newStatus,
        note: `Status updated to ${newStatus}`
      });
      
      if (response.success) {
        // Update local state
        setComplaints(prev => 
          prev.map(complaint => 
            complaint._id === complaintId 
              ? { ...complaint, status: newStatus, progress: response.data.complaint.progress }
              : complaint
          )
        );
        Alert.alert('Success', 'Blotter status updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const showStatusOptions = (complaint) => {
    const statusOptions = ['Pending', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
    
    Alert.alert(
      `Update Status - ${complaint.title}`,
      'Select new status:',
      [
        ...statusOptions.map(status => ({
          text: status,
          onPress: () => handleStatusUpdate(complaint._id, status),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderComplaintCard = (complaint) => (
    <TouchableOpacity
      key={complaint._id}
      style={styles.complaintCard}
      onPress={() => handleComplaintPress(complaint)}
    >
      <View style={styles.complaintHeader}>
        <View style={styles.complaintTitleContainer}>
          <Text style={styles.complaintTitle} numberOfLines={2}>
            {complaint.title}
          </Text>
          <View style={styles.complaintMeta}>
            <Text style={[styles.priorityBadge, { backgroundColor: getPriorityColor(complaint.priority) }]}>
              {complaint.priority}
            </Text>
            <Text style={styles.categoryText}>{complaint.category}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: getStatusColor(complaint.status) }]}
          onPress={() => showStatusOptions(complaint)}
        >
          <Text style={styles.statusText}>{complaint.status}</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.complaintDescription} numberOfLines={2}>
        {complaint.description}
      </Text>
      
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>Progress: {complaint.progress}%</Text>
        <View style={styles.progressBar}>
          <View 
            style={[styles.progressFill, { 
              width: `${complaint.progress}%`,
              backgroundColor: getStatusColor(complaint.status)
            }]} 
          />
        </View>
      </View>
      
      <View style={styles.complaintFooter}>
        <View style={styles.footerLeft}>
          <Text style={styles.submitterText}>
            {complaint.isAnonymous ? 'Anonymous' : complaint.user?.firstName}
          </Text>
          <Text style={styles.locationText}>📍 {complaint.location}</Text>
        </View>
        <Text style={styles.dateText}>{formatDate(complaint.createdAt)}</Text>
      </View>
      
      {complaint.assignedTo && (
        <View style={styles.assignedContainer}>
          <Text style={styles.assignedText}>
            Assigned to: {complaint.assignedTo.firstName} {complaint.assignedTo.lastName}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Blotters</Text>
        <Text style={styles.subtitle}>Review and update blotter status</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search blotters..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonSelected
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === filter && styles.filterTextSelected
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.complaintsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
          if (isCloseToBottom) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {isLoading && complaints.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading blotters...</Text>
          </View>
        ) : complaints.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No blotters found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try adjusting your search' : `No ${selectedFilter.toLowerCase()} blotters`}
            </Text>
          </View>
        ) : (
          <>
            {complaints.map(renderComplaintCard)}
            {isLoading && hasMore && (
              <View style={styles.loadingMoreContainer}>
                <Text style={styles.loadingText}>Loading more...</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
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
  backButton: {
    marginBottom: 10,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
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
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
  },
  filterButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  filterTextSelected: {
    color: '#fff',
  },
  complaintsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingMoreContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  complaintCard: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  complaintTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  complaintMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  complaintDescription: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
    color: '#666',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    marginBottom: 4,
    color: '#666',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e1e1e1',
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
  },
  submitterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
  },
  dateText: {
    fontSize: 12,
    opacity: 0.7,
    color: '#666',
  },
  assignedContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  assignedText: {
    fontSize: 12,
    color: '#007AFF',
  },
});

export default AdminBlottersScreen;
