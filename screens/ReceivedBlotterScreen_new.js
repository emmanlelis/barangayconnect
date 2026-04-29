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
  Linking
} from 'react-native';
import { blotterAPI } from '../services/api';

const ReceivedBlotterScreen = ({ navigation, route }) => {
  const [blotters, setBlotters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBlotter, setSelectedBlotter] = useState(null);
  const initialStatus = route?.params?.initialStatus || 'All';

  useEffect(() => {
    loadReceivedBlotters();
  }, [initialStatus]);

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return '#34C759';
      case 'ongoing':
      case 'ongoing-no-mediation':
      case 'ongoing-2nd':
      case 'ongoing-3rd':
      case 'lupon':
        return '#FF9500';
      case 'new':
        return '#007AFF';
      case 'no-show':
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

  const loadReceivedBlotters = async () => {
    setIsLoading(true);
    try {
      const response = await blotterAPI.getMyReceivedBlotters(
        initialStatus && initialStatus !== 'All' ? { status: initialStatus } : {}
      );

      if (response.success) {
        setBlotters(response.data.blotters || []);
      } else {
        Alert.alert('Error', response.message || 'Failed to load received blotters');
      }
    } catch (error) {
      console.error('Load received blotters error:', error);
      Alert.alert('Error', error?.message || 'Failed to load received blotters');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceivedBlotters();
    setRefreshing(false);
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

  const renderBlotterCard = (blotter) => (
    <TouchableOpacity
      key={blotter._id}
      style={styles.card}
      onPress={() => setSelectedBlotter(blotter)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.caseNumber}>{blotter.caseNumber || 'No Case Number'}</Text>
          <Text style={styles.cardMeta}>Filed: {formatDate(blotter.createdAt)}</Text>
        </View>
        <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(blotter.status) }]}> 
          {getStatusLabel(blotter.status)}
        </Text>
      </View>

      <Text style={styles.respondent}>Against: {blotter.respondent || 'N/A'}</Text>
      <Text style={styles.complainant}>From: {blotter.complainant || 'N/A'}</Text>

      <Text style={styles.description} numberOfLines={3}>
        {blotter.description || 'No description available.'}
      </Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Mediation Date</Text>
          <Text style={styles.summaryValue}>
            {blotter.dateOfMeeting ? formatDate(blotter.dateOfMeeting) : 'Not scheduled'}
          </Text>
        </View>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Mediation Time</Text>
          <Text style={styles.summaryValue}>{blotter.mediationTime || 'N/A'}</Text>
        </View>
      </View>

      {Array.isArray(blotter.generatedDocuments) && blotter.generatedDocuments.length > 0 && (
        <View style={styles.documentIndicator}>
          <Text style={styles.documentIndicatorText}>📎 {blotter.generatedDocuments.length} document(s) attached</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDetailView = () => {
    if (!selectedBlotter) return null;

    const documents = Array.isArray(selectedBlotter.generatedDocuments) 
      ? selectedBlotter.generatedDocuments 
      : [];

    return (
      <View style={styles.detailContainer}>
        <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={true}>
          <View style={styles.detailHeader}>
            <TouchableOpacity 
              style={styles.detailCloseButton}
              onPress={() => setSelectedBlotter(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.detailCloseText}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailContent}>
            <Text style={styles.detailTitle}>{selectedBlotter.caseNumber || 'Blotter Details'}</Text>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Case Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <Text style={styles.detailValue}>{getStatusLabel(selectedBlotter.status)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Complainant:</Text>
                <Text style={styles.detailValue}>{selectedBlotter.complainant || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Respondent:</Text>
                <Text style={styles.detailValue}>{selectedBlotter.respondent || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Description</Text>
              <Text style={styles.detailDescription}>{selectedBlotter.description || 'No description provided'}</Text>
            </View>

            {selectedBlotter.dateOfMeeting && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Mediation Schedule</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedBlotter.dateOfMeeting)}</Text>
                </View>
                {selectedBlotter.mediationTime && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time:</Text>
                    <Text style={styles.detailValue}>{selectedBlotter.mediationTime}</Text>
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

  if (selectedBlotter) {
    return renderDetailView();
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Received Blotter</Text>
        <Text style={styles.subtitle}>
          {initialStatus && initialStatus !== 'All'
            ? `Showing ${initialStatus} blotters linked to your account`
            : 'Blotter summaries linked to your account'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.homeButton} activeOpacity={0.8}>
            <Text style={styles.homeText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading received blotters...</Text>
          </View>
        ) : blotters.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No received blotters yet</Text>
            <Text style={styles.emptySubtext}>
              Once an admin links a defendant account to a mediation case, it will appear here.
            </Text>
          </View>
        ) : (
          blotters.map(renderBlotterCard)
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
    color: '#15202b',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#667085',
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
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e6eaf2',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  caseNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#667085',
  },
  statusBadge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  respondent: {
    marginTop: 12,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  complainant: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  summaryBlock: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  documentIndicator: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e6eaf2',
  },
  documentIndicatorText: {
    fontSize: 12,
    color: '#0066cc',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6eaf2',
  },
  emptyText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#6b7280',
    textAlign: 'center',
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

export default ReceivedBlotterScreen;
