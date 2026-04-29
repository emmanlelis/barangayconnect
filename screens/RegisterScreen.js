import React, { useState, useRef, useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { useAuth } from '../context/AuthContext';
import { authAPI, uploadAPI } from '../services/api';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    address: {
      barangay: '',
      purok: '',
      street: '',
      city: '',
      province: '',
    },
    profilePicture: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [issuer, setIssuer] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const { refreshProfile } = useAuth();

  const navigateToHomeAfterVerification = () => {
    if (typeof navigation?.dispatch === 'function') {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] })
      );
      return;
    }

    if (typeof navigation?.goHome === 'function') {
      navigation.goHome();
      return;
    }

    if (typeof navigation?.navigate === 'function') {
      navigation.navigate('Home');
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('address.')) {
      const addressField = field.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handlePickProfilePicture = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      },
      async (response) => {
        if (response.didCancel) return;
        if (response.errorMessage) {
          Alert.alert('Error', response.errorMessage);
          return;
        }

        const asset = response.assets?.[0];
        if (!asset?.uri) {
          Alert.alert('Error', 'Unable to select image');
          return;
        }

        try {
          setUploadingProfile(true);
          const uploadForm = new FormData();
          uploadForm.append('image', {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || `profile_${Date.now()}.jpg`,
          });

          const uploadResult = await uploadAPI.uploadPublicProfilePicture(uploadForm);
          const imageUrl = uploadResult?.data?.profilePicture || uploadResult?.data?.image?.url;

          if (!imageUrl) {
            throw new Error('No image URL returned');
          }

          handleInputChange('profilePicture', imageUrl);
        } catch (error) {
          Alert.alert('Error', error?.message || 'Failed to upload profile picture');
        } finally {
          setUploadingProfile(false);
        }
      }
    );
  };

  const validateForm = () => {
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.phoneNumber ||
      !formData.address.barangay ||
      !formData.address.purok ||
      !formData.address.city ||
      !formData.address.province
    ) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }

    return true;
  };

  const handleSendOtp = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSendingOtp(true);
    try {
      // Normalize phone number: if starts with 0, convert to +63 (Philippines) as default
      const normalized = { ...formData };
      const rawPhone = (formData.phoneNumber || '').trim();
      if (rawPhone) {
        if (rawPhone.startsWith('0')) {
          normalized.phoneNumber = '+63' + rawPhone.slice(1);
        } else if (!rawPhone.startsWith('+')) {
          // assume local number without leading 0, prefix +63
          normalized.phoneNumber = '+63' + rawPhone;
        }
      }

      const result = await authAPI.sendRegistrationOtp(normalized);

      setVerificationId(result?.data?.verificationId || '');
      setSetupKey(result?.data?.setupKey || '');
      setOtpAuthUrl(result?.data?.otpAuthUrl || '');
      setAccountLabel(result?.data?.accountLabel || normalized.email || normalized.phoneNumber || 'BarangayConnect user');
      setIssuer(result?.data?.issuer || 'BarangayConnect');
      setIsOtpSent(true);
      setVerificationMessage(
        result?.data?.expiresInSeconds
          ? `Add this account to your authenticator app. This setup expires in ${Math.ceil(result.data.expiresInSeconds / 60)} minutes.`
          : 'Add this account to your authenticator app.'
      );

      // start resend countdown (default 60s) if not provided by server
      const seconds = result?.data?.resendAfterSeconds || 60;
      setResendSeconds(seconds);
      const timer = setInterval(() => {
        setResendSeconds((s) => {
          if (s <= 1) {
            clearInterval(timer);
            resendTimerRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      resendTimerRef.current = timer;

      if (result?.data?.setupKey) {
        Alert.alert('Authenticator setup ready', 'Use the setup key below in Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.');
      } else {
        Alert.alert('Authenticator setup ready', 'Please add the account to your authenticator app.');
      }
    } catch (error) {
      Alert.alert('Registration Failed', error?.message || 'Failed to send verification code');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationId) {
      Alert.alert('Error', 'Please set up the authenticator first');
      return;
    }

    if (!otpCode || otpCode.trim().length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit authenticator code');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const result = await authAPI.verifyRegistrationOtp({
        verificationId,
        otp: otpCode.trim(),
      });

      if (!result.success) {
        const firstValidationError = result?.errors?.[0]?.msg;
        Alert.alert('Registration Failed', firstValidationError || result.message || 'Verification failed');
        return;
      }

      await refreshProfile();
      navigateToHomeAfterVerification();
    } catch (error) {
      Alert.alert('Verification Failed', error?.message || 'An unexpected error occurred');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Allow resend when countdown reaches zero
  const canResend = resendSeconds === 0;

  const resendTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Image
            source={require('../assets/BarangayConnect Logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join BarangayConnect</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.profileSectionRow}>
            <TouchableOpacity style={styles.profilePhotoButton} onPress={handlePickProfilePicture} disabled={uploadingProfile}>
              {formData.profilePicture ? (
                <Image source={{ uri: formData.profilePicture }} style={styles.profilePhotoPreview} />
              ) : (
                <Text style={styles.profilePhotoInitial}>+</Text>
              )}
            </TouchableOpacity>

            <View style={styles.profileTextWrap}>
              <Text style={styles.profileSectionTitle}>Profile Picture</Text>
              <Text style={styles.profileSectionHint}>
                {uploadingProfile ? 'Uploading...' : 'Tap the photo box to upload'}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="First Name *"
              value={formData.firstName}
              onChangeText={(value) => handleInputChange('firstName', value)}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Last Name *"
              value={formData.lastName}
              onChangeText={(value) => handleInputChange('lastName', value)}
              autoCapitalize="words"
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Middle Name (Optional)"
            value={formData.middleName}
            onChangeText={(value) => handleInputChange('middleName', value)}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Phone Number *"
            value={formData.phoneNumber}
            onChangeText={(value) => handleInputChange('phoneNumber', value)}
            keyboardType="phone-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Barangay *"
            value={formData.address.barangay}
            onChangeText={(value) => handleInputChange('address.barangay', value)}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Purok *"
            value={formData.address.purok}
            onChangeText={(value) => handleInputChange('address.purok', value)}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Street Address (Optional)"
            value={formData.address.street}
            onChangeText={(value) => handleInputChange('address.street', value)}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="City *"
            value={formData.address.city}
            onChangeText={(value) => handleInputChange('address.city', value)}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Province *"
            value={formData.address.province}
            onChangeText={(value) => handleInputChange('address.province', value)}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Password *"
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            secureTextEntry
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password *"
            value={formData.confirmPassword}
            onChangeText={(value) => handleInputChange('confirmPassword', value)}
            secureTextEntry
            autoCapitalize="none"
          />

          {!isOtpSent ? (
            <TouchableOpacity
              style={[styles.button, isSendingOtp && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={isSendingOtp}
            >
              <Text style={styles.buttonText}>
                {isSendingOtp ? 'Creating Setup...' : 'Set Up Authenticator'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.otpSection}>
              <Text style={styles.otpLabel}>Authenticator Verification Code</Text>
              <Text style={styles.otpHint}>
                {verificationMessage || 'Enter the 6-digit code from your authenticator app.'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.button, isVerifyingOtp && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={isVerifyingOtp}
              >
                <Text style={styles.buttonText}>
                  {isVerifyingOtp ? 'Verifying...' : 'Verify & Create Account'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setIsOtpSent(false);
                  setVerificationId('');
                  setSetupKey('');
                  setOtpAuthUrl('');
                  setAccountLabel('');
                  setIssuer('');
                  setOtpCode('');
                  setVerificationMessage('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Edit Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={async () => {
                  if (!otpAuthUrl) {
                    Alert.alert('Open Authenticator', 'Use the setup key below to add the account manually.');
                    return;
                  }

                  try {
                    await Linking.openURL(otpAuthUrl);
                  } catch (error) {
                    Alert.alert('Open Authenticator', 'Use the setup key below to add the account manually.');
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>Open in Authenticator</Text>
              </TouchableOpacity>

              <View style={styles.setupBox}>
                <Text style={styles.setupLabel}>Manual setup key</Text>
                <View style={styles.qrWrap}>
                  {otpAuthUrl ? (
                    <QRCode
                      value={otpAuthUrl}
                      size={180}
                      backgroundColor="#ffffff"
                    />
                  ) : (
                    <View style={styles.qrFallback}>
                      <Text style={styles.qrFallbackText}>QR code unavailable</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.setupHintSecondary}>
                  Scan this with Google Authenticator, Microsoft Authenticator, Authy, or any TOTP app.
                </Text>
                <TextInput
                  style={styles.setupKeyInput}
                  value={setupKey}
                  editable={false}
                  selectTextOnFocus
                />
                <Text style={styles.setupHint}>
                  Open your authenticator app, choose Add account manually, then enter this key for {accountLabel || 'this account'}.
                </Text>
                <Text style={styles.setupHintSecondary}>
                  Issuer: {issuer || 'BarangayConnect'}
                </Text>
              </View>

              <View style={{ alignItems: 'center', marginTop: 8 }}>
                {canResend ? (
                  <TouchableOpacity
                    style={[styles.secondaryButton, { paddingVertical: 6 }]}
                    onPress={handleSendOtp}
                    disabled={isSendingOtp}
                  >
                    <Text style={styles.secondaryButtonText}>{isSendingOtp ? 'Generating...' : 'Generate New Setup'}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: '#64748b' }}>New setup available in {resendSeconds}s</Text>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>Already have an account? Sign In</Text>
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
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 20,
  },
  logoImage: {
    width: 180,
    height: 70,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  profileSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  profilePhotoButton: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: '#f1f5ff',
    borderWidth: 1,
    borderColor: '#b7ccff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profilePhotoPreview: {
    width: '100%',
    height: '100%',
  },
  profilePhotoInitial: {
    fontSize: 30,
    color: '#007AFF',
    lineHeight: 34,
  },
  profileTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  profileSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  profileSectionHint: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  halfInput: {
    width: '48%',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  otpSection: {
    marginTop: 4,
  },
  otpLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  otpHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  setupBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  setupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignSelf: 'center',
  },
  qrFallback: {
    width: 180,
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  qrFallbackText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  setupKeyInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  setupHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  setupHintSecondary: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default RegisterScreen;