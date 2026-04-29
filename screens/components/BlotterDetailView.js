import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';

const BlotterDetailView = ({ blotter, onClose, type = 'received' }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
      case 'Resolved':
        return '#34C759';
      case 'ongoing':
      case 'In Progress':
      case 'ongoing-no-mediation':
      case 'ongoing-2nd':
      case 'ongoing-3rd':
      case 'lupon':
        return '#FF9500';
      case 'new':
      case 'Pending':
        return '#007AFF';
      case 'no-show':
      case 'No Show':
      case 'certificate-action':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'ongoing-no-mediation':
        return 'Ongoing - No Mediation';
      case 'ongoing-2nd':
        return 'Ongoing - 2nd Mediation';
      case 'ongoing-3rd':
        return 'Ongoing - 3rd Mediation';
      case 'certificate-action':
        return 'Certificate Action';
      default:
        return status || 'Unknown';
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
    if (!dateString) return 'N/A';
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

  const documents = Array.isArray(blotter.generatedDocuments) 
    ? blotter.generatedDocuments 
    : (Array.isArray(blotter.blotterUpdate?.generatedDocuments) 
      ? blotter.blotterUpdate.generatedDocuments 
      : []);

  const title = blotter.title || blotter.caseNumber || 'Blotter Details';
  const status = blotter.status;
  const description = blotter.description;

  return (
    <View style={styles.detailContainer}>
      <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={true}>
        <View style={styles.detailHeader}>
          <TouchableOpacity 
            style={styles.detailCloseButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.detailCloseText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailContent}>
          <Text style={styles.detailTitle}>{title}</Text>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>
              {type === 'complaint' ? 'Complaint Information' : 'Case Information'}
            </Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>{getStatusLabel(status)}</Text>
            </View>

            {blotter.category && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category:</Text>
                <Text style={styles.detailValue}>{blotter.category}</Text>
              </View>
            )}

            {blotter.priority && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Priority:</Text>
                <Text style={[styles.detailValue, { color: getPriorityColor(blotter.priority) }]}>
                  {blotter.priority}
                </Text>
              </View>
            )}

            {blotter.progress !== undefined && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Progress:</Text>
                <Text style={styles.detailValue}>{blotter.progress}%</Text>
              </View>
            )}

            {blotter.complainant && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Complainant:</Text>
                <Text style={styles.detailValue}>{blotter.complainant}</Text>
              </View>
            )}

            {blotter.respondent && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Respondent:</Text>
                <Text style={styles.detailValue}>{blotter.respondent}</Text>
              </View>
            )}
          </View>

          {description && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Description</Text>
              <Text style={styles.detailDescription}>{description}</Text>
            </View>
          )}

          {(blotter.dateOfMeeting || (blotter.blotterUpdate?.mediationDate)) && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Mediation Schedule</Text>
              {(blotter.dateOfMeeting || blotter.blotterUpdate?.mediationDate) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(blotter.dateOfMeeting || blotter.blotterUpdate?.mediationDate)}
                  </Text>
                </View>
              )}
              {(blotter.mediationTime || blotter.blotterUpdate?.mediationTime) && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time:</Text>
                  <Text style={styles.detailValue}>{blotter.mediationTime || blotter.blotterUpdate?.mediationTime}</Text>
                </View>
              )}
            </View>
          )}

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

          <View style={styles.spacer} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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

export default BlotterDetailView;
