import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { complaintAPI, uploadAPI } from '../services/api';

const ComplaintScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'Medium',
    location: '',
    isAnonymous: false,
    anonymousContact: '',
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
      Alert.alert('Error', 'Please enter a complaint title');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please enter a complaint description');
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
    if (formData.isAnonymous && !formData.anonymousContact.trim()) {
      Alert.alert('Error', 'Please provide contact information for anonymous complaints');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

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

      // Submit complaint
      const complaintData = {
        ...formData,
        images: uploadedImages,
      };

      const response = await complaintAPI.submit(complaintData);
      
      if (response.success) {
        Alert.alert(
          'Success',
          'Your complaint has been submitted successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Status'),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to submit complaint');
      }
    } catch (error) {
      console.error('Submit complaint error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Submit Complaint</Text>
          <Text style={styles.subtitle}>Help us improve your community</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Complaint Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief description of the issue"
            value={formData.title}
            onChangeText={(value) => handleInputChange('title', value)}
          />
          
          <Text style={styles.label}>Category *</Text>
          <View style={styles.categoryContainer}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  formData.category === cat && styles.categoryButtonSelected
                ]}
                onPress={() => selectCategory(cat)}
              >
                <Text style={[
                  styles.categoryText,
                  formData.category === cat && styles.categoryTextSelected
                ]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityContainer}>
            {priorities.map(prio => (
              <TouchableOpacity
                key={prio}
                style={[
                  styles.priorityButton,
                  formData.priority === prio && styles.priorityButtonSelected
                ]}
                onPress={() => selectPriority(prio)}
              >
                <Text style={[
                  styles.priorityText,
                  formData.priority === prio && styles.priorityTextSelected
                ]}>{prio}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            placeholder="Where is this issue located?"
            value={formData.location}
            onChangeText={(value) => handleInputChange('location', value)}
          />
          
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
              placeholder="Contact information (phone or email)"
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
              {isLoading ? 'Submitting...' : 'Submit Complaint'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  priorityButton: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  priorityButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  priorityText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  priorityTextSelected: {
    color: '#fff',
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

export default ComplaintScreen;
