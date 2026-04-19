import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { complaintAPI, adminAPI } from '../../services/api';

const AdminComplaintDetailScreen = ({ navigation, route }) => {
  const [complaint, setComplaint] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const complaintId = route.params?.id;

  useEffect(() => {
    loadComplaintDetail();
  }, [complaintId]);

  const loadComplaintDetail = async () => {
    setIsLoading(true);
    try {
      const response = await complaintAPI.getComplaint(complaintId);
      if (response.success) {
        setComplaint(response.data.complaint);
      } else {
        Alert.alert('Error', response.message || 'Failed to load complaint details');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load complaint detail error:', error);
      Alert.alert('Error', 'Failed to load complaint details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) {
      Alert.alert('Error', 'Please select a status');
      return;
    }

    try {
      const response = await adminAPI.updateComplaintStatus(complaintId, {
        status: selectedStatus,
        note: `Status updated to ${selectedStatus}`
      });
      
      if (response.success) {
        setComplaint(prev => ({
          ...prev,
          status: selectedStatus,
          progress: response.data.complaint.progress,
          actualResolutionDate: response.data.complaint.actualResolutionDate
        }));
        setShowStatusModal(false);
        setSelectedStatus('');
        Alert.alert('Success', 'Complaint status updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      Alert.alert('Error', 'Please enter a note');
      return;
    }

    try {
      const response = await adminAPI.addAdminNote(complaintId, {
        note: noteText
      });
      
      if (response.success) {
        setComplaint(prev => ({
          ...prev,
          adminNotes: [...prev.adminNotes, response.data.note]
        }));
        setNoteText('');
        setShowNoteModal(false);
        Alert.alert('Success', 'Admin note added successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to add note');
      }
    } catch (error) {
      console.error('Add note error:', error);
      Alert.alert('Error', 'Failed to add note');
    }
  };

  const showStatusOptions = () => {
    const statusOptions = ['Pending', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
    
    Alert.alert(
      'Update Status',
      'Select new status:',
      [
        ...statusOptions.map(status => ({
          text: status,
          onPress: () => {
            setSelectedStatus(status);
            setShowStatusModal(true);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderImage = (image, index) => (
    <View key={index} style={styles.imageContainer}>
      <Text style={styles.imageName}>Image {index + 1}</Text>
      <Text style={styles.imageDate}>{formatDate(image.uploadedAt)}</Text>
    </View>
  );

  const renderAdminNote = (note, index) => (
    <View key={index} style={styles.adminNote}>
      <View style={styles.noteHeader}>
        <Text style={styles.noteAuthor}>
          {note.addedBy?.firstName} {note.addedBy?.lastName}
        </Text>
        <Text style={styles.noteDate}>{formatDate(note.addedAt)}</Text>
      </View>
      <Text style={styles.noteContent}>{note.note}</Text>
    </View>
  );

  const renderStatusHistory = (history, index) => (
    <View key={index} style={styles.statusHistoryItem}>
      <View style={styles.historyHeader}>
        <Text style={[styles.historyStatus, { backgroundColor: getStatusColor(history.status) }]}>
          {history.status}
        </Text>
        <Text style={styles.historyDate}>{formatDate(history.changedAt)}</Text>
      </View>
      <Text style={styles.historyAuthor}>
        by {history.changedBy?.firstName} {history.changedBy?.lastName}
      </Text>
      {history.note && <Text style={styles.historyNote}>{history.note}</Text>}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading complaint details...</Text>
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load complaint</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Complaint Details</Text>
        </View>

        <View style={styles.complaintInfo}>
          <Text style={styles.complaintTitle}>{complaint.title}</Text>
          
          <View style={styles.complaintMeta}>
            <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(complaint.status) }]}>
              {complaint.status}
            </Text>
            <Text style={[styles.priorityBadge, { backgroundColor: getPriorityColor(complaint.priority) }]}>
              {complaint.priority}
            </Text>
            <Text style={styles.categoryText}>{complaint.category}</Text>
          </View>

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

          <Text style={styles.descriptionTitle}>Description</Text>
          <Text style={styles.description}>{complaint.description}</Text>

          <Text style={styles.locationTitle}>Location</Text>
          <Text style={styles.location}>📍 {complaint.location}</Text>

          <View style={styles.submitterInfo}>
            <Text style={styles.submitterTitle}>Submitted by</Text>
            <Text style={styles.submitterName}>
              {complaint.isAnonymous ? 'Anonymous' : `${complaint.user?.firstName} ${complaint.user?.lastName}`}
            </Text>
            {!complaint.isAnonymous && (
              <>
                <Text style={styles.submitterEmail}>{complaint.user?.email}</Text>
                <Text style={styles.submitterPhone}>{complaint.user?.phoneNumber}</Text>
              </>
            )}
            {complaint.isAnonymous && complaint.anonymousContact && (
              <Text style={styles.anonymousContact}>Contact: {complaint.anonymousContact}</Text>
            )}
            <Text style={styles.submittedDate}>Submitted: {formatDate(complaint.createdAt)}</Text>
          </View>

          {complaint.images && complaint.images.length > 0 && (
            <View style={styles.imagesSection}>
              <Text style={styles.sectionTitle}>Attached Images</Text>
              {complaint.images.map(renderImage)}
            </View>
          )}

          {complaint.assignedTo && (
            <View style={styles.assignedSection}>
              <Text style={styles.sectionTitle}>Assigned to</Text>
              <Text style={styles.assignedName}>
                {complaint.assignedTo.firstName} {complaint.assignedTo.lastName}
              </Text>
              <Text style={styles.assignedPosition}>{complaint.assignedTo.position}</Text>
              {complaint.assignedAt && (
                <Text style={styles.assignedDate}>Assigned: {formatDate(complaint.assignedAt)}</Text>
              )}
            </View>
          )}

          {complaint.adminNotes && complaint.adminNotes.length > 0 && (
            <View style={styles.notesSection}>
              <Text style={styles.sectionTitle}>Admin Notes</Text>
              {complaint.adminNotes.map(renderAdminNote)}
            </View>
          )}

          {complaint.statusHistory && complaint.statusHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Status History</Text>
              {complaint.statusHistory.map(renderStatusHistory)}
            </View>
          )}

          {complaint.userFeedback && (
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionTitle}>User Feedback</Text>
              <View style={styles.feedbackContent}>
                <Text style={styles.feedbackRating}>
                  Rating: {'⭐'.repeat(complaint.userFeedback.rating)}
                </Text>
                {complaint.userFeedback.comment && (
                  <Text style={styles.feedbackComment}>{complaint.userFeedback.comment}</Text>
                )}
                <Text style={styles.feedbackDate}>
                  Submitted: {formatDate(complaint.userFeedback.submittedAt)}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.statusButton]}
          onPress={showStatusOptions}
        >
          <Text style={styles.actionButtonText}>Update Status</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.noteButton]}
          onPress={() => setShowNoteModal(true)}
        >
          <Text style={styles.actionButtonText}>Add Note</Text>
        </TouchableOpacity>
      </View>

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Status</Text>
            <Text style={styles.modalSubtitle}>New status: {selectedStatus}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Add a note (optional)"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowStatusModal(false);
                  setSelectedStatus('');
                  setNoteText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleStatusUpdate}
              >
                <Text style={styles.confirmButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Note Modal */}
      <Modal
        visible={showNoteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Admin Note</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Enter your note..."
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddNote}
              >
                <Text style={styles.confirmButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  scrollView: {
    flex: 1,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  complaintInfo: {
    padding: 20,
  },
  complaintTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  complaintMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressLabel: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e1e1e1',
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    color: '#333',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  location: {
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  submitterInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  submitterTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  submitterName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  submitterEmail: {
    fontSize: 14,
    marginBottom: 2,
    color: '#666',
  },
  submitterPhone: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  anonymousContact: {
    fontSize: 14,
    marginBottom: 4,
    color: '#007AFF',
  },
  submittedDate: {
    fontSize: 12,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  imagesSection: {
    marginBottom: 20,
  },
  imageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  imageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  imageDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  assignedSection: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  assignedName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  assignedPosition: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  assignedDate: {
    fontSize: 12,
    color: '#666',
  },
  notesSection: {
    marginBottom: 20,
  },
  adminNote: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
  },
  noteContent: {
    fontSize: 14,
    color: '#333',
  },
  historySection: {
    marginBottom: 20,
  },
  statusHistoryItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
  },
  historyAuthor: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  historyNote: {
    fontSize: 14,
    color: '#333',
  },
  feedbackSection: {
    backgroundColor: '#f0fff4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  feedbackContent: {
    marginTop: 8,
  },
  feedbackRating: {
    fontSize: 16,
    marginBottom: 8,
    color: '#1a1a1a',
  },
  feedbackComment: {
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
  },
  feedbackDate: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButton: {
    backgroundColor: '#007AFF',
  },
  noteButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 16,
    color: '#666',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminComplaintDetailScreen;
