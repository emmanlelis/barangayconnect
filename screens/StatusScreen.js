import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { complaintAPI } from '../services/api';

const StatusScreen = ({ navigation, route }) => {
  const [complaints, setComplaints] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState(route?.params?.initialFilter || 'All');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  const filters = ['All', 'Pending', 'In Progress', 'Resolved', 'No Show'];

  useEffect(() => {
    loadComplaints();
  }, [selectedFilter]);

  useEffect(() => {
    if (route?.params?.initialFilter) {
      setSelectedFilter(route.params.initialFilter);
    }
  }, [route?.params?.initialFilter]);

  const loadComplaints = async () => {
    setIsLoading(true);
    try {
      const filters = selectedFilter === 'All' ? {} : { status: selectedFilter };
      const response = await complaintAPI.getMyComplaints(filters);
      
      if (response.success) {
        setComplaints(response.data.complaints);
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
    await loadComplaints();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#007AFF';
      case 'In Progress': return '#FF9500';
      case 'Resolved': return '#34C759';
      case 'No Show': return '#FF3B30';
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openDocument = async (url) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this document');
      }
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const handleComplaintPress = (complaint) => {
    setSelectedComplaint(complaint);
  };

  const renderDetailView = () => {
    if (!selectedComplaint) return null;

    const documents = Array.isArray(selectedComplaint.blotterUpdate?.generatedDocuments) 
      ? selectedComplaint.blotterUpdate.generatedDocuments 
      : [];

    return (
      <View style={styles.detailContainer}>
        <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={true}>
          <View style={styles.detailHeader}>
            <TouchableOpacity 
              style={styles.detailCloseButton}
              onPress={() => setSelectedComplaint(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.detailCloseText}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailContent}>
            <Text style={styles.detailTitle}>{selectedComplaint.title}</Text>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Complaint Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <Text style={styles.detailValue}>{selectedComplaint.status}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category:</Text>
                <Text style={styles.detailValue}>{selectedComplaint.category}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Priority:</Text>
                <Text style={[styles.detailValue, { color: getPriorityColor(selectedComplaint.priority) }]}>
                  {selectedComplaint.priority}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Progress:</Text>
                <Text style={styles.detailValue}>{selectedComplaint.progress}%</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Description</Text>
              <Text style={styles.detailDescription}>{selectedComplaint.description}</Text>
            </View>

            {selectedComplaint.blotterUpdate && (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Blotter Case Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Case Number:</Text>
                    <Text style={styles.detailValue}>{selectedComplaint.blotterUpdate.caseNumber || 'N/A'}</Text>
                  </View>
                  {selectedComplaint.blotterUpdate.mediationDate && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Mediation Date:</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(selectedComplaint.blotterUpdate.mediationDate)}
                        {selectedComplaint.blotterUpdate.mediationTime ? ` ${selectedComplaint.blotterUpdate.mediationTime}` : ''}
                      </Text>
                    </View>
                  )}
                  {selectedComplaint.blotterUpdate.subpoenaDelivery && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Subpoena:</Text>
                      <Text style={styles.detailValue}>
                        {selectedComplaint.blotterUpdate.subpoenaDelivery === 'email' ? 'Sent through email' : 'Physical service'}
                      </Text>
                    </View>
                  )}
                </View>

                {documents.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>📎 Attached Documents ({documents.length})</Text>
                    <Text style={styles.documentHint}>Tap any document to view it</Text>
                    {documents.map((doc, index) => (
                      <TouchableOpacity
                        key={doc._id || `doc-${index}`}
                        style={styles.documentCard}
                        onPress={() => openDocument(doc.url)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.documentCardContent}>
                          <View style={styles.documentIcon}>
                            <Text style={styles.documentIconText}>📄</Text>
                          </View>
                          <View style={styles.documentInfo}>
                            <Text style={styles.documentName} numberOfLines={2}>
                              {doc.filename || doc.subject || `Document ${index + 1}`}
                            </Text>
                            <Text style={styles.documentType}>
                              {doc.documentType ? doc.documentType.charAt(0).toUpperCase() + doc.documentType.slice(1) : 'Document'}
                            </Text>
                            {doc.uploadedAt && (
                              <Text style={styles.documentDate}>{formatDate(doc.uploadedAt)}</Text>
                            )}
                          </View>
                          <View style={styles.documentArrow}>
                            <Text style={styles.documentArrowText}>→</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={styles.spacer} />
          </View>
        </ScrollView>
      </View>
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

      {complaint.blotterUpdate && (
        <View style={styles.blotterUpdateContainer}>
          <Text style={styles.blotterCaseText}>Case: {complaint.blotterUpdate.caseNumber || 'N/A'}</Text>

          {complaint.blotterUpdate.mediationDate && (
            <Text style={styles.blotterMetaText}>
              Mediation Schedule: {formatDate(complaint.blotterUpdate.mediationDate)}
              {complaint.blotterUpdate.mediationTime ? ` ${complaint.blotterUpdate.mediationTime}` : ''}
            </Text>
          )}

          <Text style={styles.blotterMetaText}>
            Subpoena: {complaint.blotterUpdate.subpoenaDelivery === 'email' ? 'Sent through email' : 'For physical service'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (selectedComplaint) {
    return renderDetailView();
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Blotter Status</Text>
        <Text style={styles.subtitle}>Track your submitted blotters</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.homeButton} activeOpacity={0.8}>
            <Text style={styles.homeText}>Home</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.loadingText}>Loading blotters...</Text>
          </View>
        ) : complaints.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No blotters found</Text>
            <Text style={styles.emptySubtext}>
              {selectedFilter === 'All' 
                ? 'You haven\'t submitted any blotters yet'
                : `No ${selectedFilter.toLowerCase()} blotters found`
              }
            </Text>
            {selectedFilter === 'All' && (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => navigation.navigate('Blotter')}
              >
                <Text style={styles.submitButtonText}>Submit Your First Blotter</Text>
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
  blotterUpdateContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  blotterCaseText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  blotterMetaText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },

  // Detail View Styles
  detailContainer: {
    flex: 1,
    backgroundColor: '#f4f7fb',
  },
  detailScroll: {
    flex: 1,
  },
  detailHeader: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 14,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e6eaf2',
  },
  detailCloseButton: {
    paddingVertical: 8,
  },
  detailCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  detailContent: {
    padding: 20,
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  detailSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6eaf2',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667085',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  detailDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#374151',
  },
  documentHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  documentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  documentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentIconText: {
    fontSize: 24,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  documentType: {
    fontSize: 12,
    color: '#667085',
    marginTop: 2,
  },
  documentDate: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  documentArrow: {
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentArrowText: {
    fontSize: 18,
    color: '#007AFF',
  },
  spacer: {
    height: 40,
  },
});

export default StatusScreen;
