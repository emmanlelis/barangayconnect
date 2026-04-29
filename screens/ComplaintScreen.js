import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { complaintAPI, uploadAPI } from '../services/api';

const BlotterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'Medium',
    location: '',
    incidentDate: '',
    respondentName: '',
    respondentRelationship: '',
    respondentAddress: '',
    isAnonymous: false,
    anonymousContact: '',
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [submittedBlotterId, setSubmittedBlotterId] = useState('');
  const [filingAgainstSomeone, setFilingAgainstSomeone] = useState(false);
  const [selectionSheet, setSelectionSheet] = useState({
    visible: false,
    type: null,
  });

  const categories = ['Infrastructure', 'Service Quality', 'Safety', 'Environmental', 'Health', 'Education', 'Others'];
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectCategory = (category) => {
    setFormData(prev => ({
      ...prev,
      category: prev.category === category ? '' : category
    }));
  };

  const selectPriority = (priority) => {
    setFormData(prev => ({
      ...prev,
      priority
    }));
  };

  const openSelectionSheet = (type) => {
    setSelectionSheet({
      visible: true,
      type,
    });
  };

  const closeSelectionSheet = () => {
    setSelectionSheet({
      visible: false,
      type: null,
    });
  };

  const handleSelection = (value) => {
    if (selectionSheet.type === 'category') {
      selectCategory(value);
    }

    if (selectionSheet.type === 'priority') {
      selectPriority(value);
    }

    closeSelectionSheet();
  };

    const clearFormFields = () => {
      setFormData({
        title: '',
        description: '',
        category: '',
        priority: 'Medium',
        location: '',
        incidentDate: '',
        respondentName: '',
        respondentRelationship: '',
        respondentAddress: '',
        isAnonymous: false,
        anonymousContact: '',
      });
      setSelectedImages([]);
      setFilingAgainstSomeone(false);
      setSubmittedBlotterId('');
    };

  const selectImage = () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 2,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          // Choose from library
          launchImageLibrary(
            {
              mediaType: 'photo',
              quality: 0.8,
              selectionLimit: 5 - selectedImages.length,
            },
            (response) => {
              if (response.assets) {
                const newImages = response.assets.map(asset => ({
                  uri: asset.uri,
                  name: asset.fileName,
                  type: asset.type,
                }));
                setSelectedImages(prev => [...prev, ...newImages].slice(0, 5));
              }
            }
          );
        }
      }
    );
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a blotter title');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please enter a blotter description');
      return false;
    }
    if (!formData.category) {
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    if (!formData.location.trim()) {
      Alert.alert('Error', 'Please enter the location');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (filingAgainstSomeone) {
      if (!formData.respondentName.trim()) {
        Alert.alert('Error', 'Please enter the name of the respondent/defendant');
        return;
      }

      if (!formData.respondentRelationship.trim()) {
        Alert.alert('Error', 'Please enter your relationship to the respondent/defendant');
        return;
      }
    }

    setIsLoading(true);
    try {
      let uploadedImages = [];
      
      // Upload images if any
      if (selectedImages.length > 0) {
        const formData = new FormData();
        selectedImages.forEach((image, index) => {
          formData.append('images', {
            uri: image.uri,
            type: image.type || 'image/jpeg',
            name: image.name || `image_${index}.jpg`,
          });
        });

        const uploadResponse = await uploadAPI.uploadComplaintImages(formData);
        if (uploadResponse.success) {
          uploadedImages = uploadResponse.data.images;
        }
      }

      // Submit blotter
      const complaintData = {
        ...formData,
        isFilingComplaintAgainstSomeone: filingAgainstSomeone,
        images: uploadedImages,
      };

      const response = await complaintAPI.submit(complaintData);
      
      if (response.success) {
        const blotterId = response.data?.blotter?.caseNumber || response.data?.blotter?.id || response.data?.complaint?.id || '';
        setSubmittedBlotterId(blotterId);
        setSuccessModalVisible(true);
      } else {
        Alert.alert('Error', response.message || 'Failed to submit blotter');
      }
    } catch (error) {
      console.error('Submit blotter error:', error);
      const errorMessage = error?.message || error?.response?.data?.message || 'An unexpected error occurred';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Submit Blotter</Text>
          <Text style={styles.subtitle}>Help us improve your community</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goHome()} style={styles.homeButton} activeOpacity={0.8}>
              <Text style={styles.homeText}>Home</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Blotter Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief description of the issue"
            value={formData.title}
            onChangeText={(value) => handleInputChange('title', value)}
          />
          
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity
            style={styles.selectorCard}
            onPress={() => openSelectionSheet('category')}
            activeOpacity={0.85}
          >
            <View style={styles.selectorCardTextWrap}>
              <Text style={styles.selectorCardLabel}>Category</Text>
              <Text style={[
                styles.selectorCardValue,
                !formData.category && styles.selectorCardPlaceholder,
              ]}>
                {formData.category || 'Choose a category'}
              </Text>
            </View>
            <View style={styles.selectorCardIconWrap}>
              <Text style={styles.selectorCardIcon}>⌄</Text>
            </View>
          </TouchableOpacity>
          
          <Text style={styles.label}>Priority</Text>
          <TouchableOpacity
            style={styles.selectorCard}
            onPress={() => openSelectionSheet('priority')}
            activeOpacity={0.85}
          >
            <View style={styles.selectorCardTextWrap}>
              <Text style={styles.selectorCardLabel}>Priority</Text>
              <Text style={styles.selectorCardValue}>{formData.priority}</Text>
            </View>
            <View style={styles.selectorCardIconWrap}>
              <Text style={styles.selectorCardIcon}>⌄</Text>
            </View>
          </TouchableOpacity>
          
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            placeholder="Where is this issue located?"
            value={formData.location}
            onChangeText={(value) => handleInputChange('location', value)}
          />
          
          <Text style={styles.label}>Incident Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (Optional)"
            value={formData.incidentDate}
            onChangeText={(value) => handleInputChange('incidentDate', value)}
          />

          <Text style={styles.label}>Are you filing a complaint against someone?</Text>
          <View style={styles.submitOptions}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                !filingAgainstSomeone && styles.optionButtonSelected
              ]}
              onPress={() => setFilingAgainstSomeone(false)}
              activeOpacity={0.85}
            >
              <Text style={[
                styles.optionText,
                !filingAgainstSomeone && styles.optionTextSelected
              ]}>No</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                filingAgainstSomeone && styles.optionButtonSelected
              ]}
              onPress={() => setFilingAgainstSomeone(true)}
              activeOpacity={0.85}
            >
              <Text style={[
                styles.optionText,
                filingAgainstSomeone && styles.optionTextSelected
              ]}>Yes</Text>
            </TouchableOpacity>
          </View>

          {filingAgainstSomeone && (
            <View style={styles.respondentSection}>
              <Text style={styles.label}>Name of Respondent/Defendant (Person being complained against)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter full name"
                value={formData.respondentName}
                onChangeText={(value) => handleInputChange('respondentName', value)}
              />

              <Text style={styles.label}>Relationship to Respondent/Defendant</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Neighbor, Relative, Co-worker"
                value={formData.respondentRelationship}
                onChangeText={(value) => handleInputChange('respondentRelationship', value)}
              />

              <Text style={styles.label}>Address of Respondent/Defendant (if known)</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                value={formData.respondentAddress}
                onChangeText={(value) => handleInputChange('respondentAddress', value)}
              />
            </View>
          )}
          
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Provide detailed information about the issue..."
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            multiline
            numberOfLines={4}
          />
          
          <Text style={styles.label}>Upload Photos (Optional)</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={selectImage}>
            <Text style={styles.uploadButtonText}>📷 Add Photo</Text>
          </TouchableOpacity>
          
          {selectedImages.length > 0 && (
            <View style={styles.selectedImagesContainer}>
              {selectedImages.map((image, index) => (
                <View key={index} style={styles.selectedImageItem}>
                  <Text style={styles.selectedImageName}>{image.name}</Text>
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          
          <Text style={styles.label}>Submit As</Text>
          <View style={styles.submitOptions}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                !formData.isAnonymous && styles.optionButtonSelected
              ]}
              onPress={() => handleInputChange('isAnonymous', false)}
            >
              <Text style={[
                styles.optionText,
                !formData.isAnonymous && styles.optionTextSelected
              ]}>👤 With Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                formData.isAnonymous && styles.optionButtonSelected
              ]}
              onPress={() => handleInputChange('isAnonymous', true)}
            >
              <Text style={[
                styles.optionText,
                formData.isAnonymous && styles.optionTextSelected
              ]}>🔒 Anonymous</Text>
            </TouchableOpacity>
          </View>

          {formData.isAnonymous && (
            <TextInput
              style={styles.input}
              placeholder="Contact information (optional - phone or email)"
              value={formData.anonymousContact}
              onChangeText={(value) => handleInputChange('anonymousContact', value)}
            />
          )}
          
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? 'Submitting...' : 'Submit Blotter'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.successBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Blotter Submitted</Text>
            <Text style={styles.successBody}>
              Your report has been received and is now in the system.
            </Text>

            <View style={styles.successIdCard}>
              <Text style={styles.successIdLabel}>Blotter ID</Text>
              <Text style={styles.successIdValue}>
                {submittedBlotterId || 'Pending assignment'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.successPrimaryButton}
              onPress={() => {
                              clearFormFields();
                              setSuccessModalVisible(false);
                              navigation.navigate('Status');
                            }}
              activeOpacity={0.9}
            >
              <Text style={styles.successPrimaryButtonText}>View Status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successSecondaryButton}
              onPress={() => {
                clearFormFields();
                setSuccessModalVisible(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.successSecondaryButtonText}>Close</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      <Modal
        visible={selectionSheet.visible}
        transparent
        animationType="fade"
        onRequestClose={closeSelectionSheet}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={styles.sheetBackdropTouch} activeOpacity={1} onPress={closeSelectionSheet} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {selectionSheet.type === 'category' ? 'Select Category' : 'Select Priority'}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {selectionSheet.type === 'category'
                ? 'Choose the category that best fits your blotter.'
                : 'Choose the urgency level for this blotter.'}
            </Text>

            {(selectionSheet.type === 'category' ? categories : priorities).map((item) => {
              const selectedValue = selectionSheet.type === 'category' ? formData.category : formData.priority;
              const isSelected = selectedValue === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.sheetOption, isSelected && styles.sheetOptionSelected]}
                  onPress={() => handleSelection(item)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sheetOptionText, isSelected && styles.sheetOptionTextSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.sheetCloseButton} onPress={closeSelectionSheet} activeOpacity={0.85}>
              <Text style={styles.sheetCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
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
  formContainer: {
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  selectorCard: {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 18,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  selectorCardTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  selectorCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#8a94a6',
    marginBottom: 4,
  },
  selectorCardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#102033',
  },
  selectorCardPlaceholder: {
    color: '#8a8f98',
  },
  selectorCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f6fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorCardIcon: {
    fontSize: 18,
    color: '#50607a',
    marginTop: -2,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetBackdropTouch: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: '#d9dee8',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#102033',
  },
  sheetSubtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: '#6b778c',
    fontSize: 14,
    lineHeight: 20,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sheetOptionSelected: {
    backgroundColor: '#eef4ff',
    borderColor: '#c9d8ff',
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#162133',
  },
  sheetOptionTextSelected: {
    color: '#2457d6',
  },
  sheetCloseButton: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#eef2f7',
  },
  sheetCloseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  successBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e8f8ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 34,
    color: '#1f9d55',
    fontWeight: '800',
    marginTop: -2,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#102033',
    marginBottom: 8,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5f6b7a',
    textAlign: 'center',
    marginBottom: 18,
  },
  successIdCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  successIdLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#7c8797',
    marginBottom: 6,
  },
  successIdValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2457d6',
  },
  successPrimaryButton: {
    width: '100%',
    backgroundColor: '#2457d6',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  successPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  successSecondaryButton: {
    width: '100%',
    backgroundColor: '#eef2f7',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  successSecondaryButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700',
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  selectedImagesContainer: {
    marginBottom: 16,
  },
  selectedImageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  selectedImageName: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
  },
  removeImageButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  respondentSection: {
    marginBottom: 4,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  optionButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  optionTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BlotterScreen;
