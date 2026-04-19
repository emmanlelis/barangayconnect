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
import { complaintAPI } from '../services/api';

const StatusScreen = ({ navigation }) => {
  const [complaints, setComplaints] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filters = ['All', 'Pending', 'In Progress', 'Under Review', 'Resolved', 'Closed'];

  useEffect(() => {
    loadComplaints();
  }, [selectedFilter]);

  const loadComplaints = async () => {
    setIsLoading(true);
    try {
      const filters = selectedFilter === 'All' ? {} : { status: selectedFilter };
      const response = await complaintAPI.getMyComplaints(filters);
      
      if (response.success) {
        setComplaints(response.data.complaints);
      } else {
        Alert.alert('Error', response.message || 'Failed to load complaints');
      }
    } catch (error) {
      console.error('Load complaints error:', error);
      Alert.alert('Error', 'Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadComplaints();
    setRefreshing(false);
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
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleComplaintPress = (complaint) => {
    // Navigate to complaint detail screen (to be implemented)
    Alert.alert(
      'Complaint Details',
      `Title: ${complaint.title}\nStatus: ${complaint.status}\nProgress: ${complaint.progress}%`,
      [{ text: 'OK' }]
    );
  };

  const renderComplaintCard = (complaint) => (
    <TouchableOpacity
      key={complaint._id}
      style={styles.complaintCard}
      onPress={() => handleComplaintPress(complaint)}
    >
      <View style={styles.complaintHeader}>
        <Text style={styles.complaintTitle} numberOfLines={2}>
          {complaint.title}
        </Text>
        <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(complaint.status) }]}>
          {complaint.status}
        </Text>
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
          <Text style={styles.categoryText}>{complaint.category}</Text>
          <Text style={[styles.priorityText, { color: getPriorityColor(complaint.priority) }]}>
            {complaint.priority}
          </Text>
        </View>
        <Text style={styles.dateText}>{formatDate(complaint.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Complaint Status</Text>
        <Text style={styles.subtitle}>Track your submitted complaints</Text>
      </View>

      <View style={styles.filterContainer}>
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
      </View>

      <View style={styles.complaintsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading complaints...</Text>
          </View>
        ) : complaints.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No complaints found</Text>
            <Text style={styles.emptySubtext}>
              {selectedFilter === 'All' 
                ? 'You haven\'t submitted any complaints yet'
                : `No ${selectedFilter.toLowerCase()} complaints found`
              }
            </Text>
            {selectedFilter === 'All' && (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => navigation.navigate('Complaint')}
              >
                <Text style={styles.submitButtonText}>Submit Your First Complaint</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          complaints.map(renderComplaintCard)
        )}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
    flexDirection: 'row',
    gap: 12,
  },
  categoryText: {
    fontSize: 12,
    opacity: 0.7,
    color: '#666',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    opacity: 0.7,
    color: '#666',
  },
});

export default StatusScreen;
