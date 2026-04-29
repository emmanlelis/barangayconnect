import React, { useState } from 'react';
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
  Modal,
  Linking,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [issuer, setIssuer] = useState('BarangayConnect');
  const [isLoading, setIsLoading] = useState(false);
  const [otpPromptVisible, setOtpPromptVisible] = useState(false);
  const [otpPromptConfig, setOtpPromptConfig] = useState({
    title: 'Two-Factor Authentication',
    message: 'Enter the 6-digit code from your authenticator app to continue.',
    icon: '🔑',
    helper: 'This keeps your account protected even if someone knows your password.',
  });
  const { login, isDarkMode } = useAuth();

  const theme = isDarkMode
    ? {
        background: '#0f172a',
        subtitle: '#cbd5e1',
        inputBackground: '#1e293b',
        inputBorder: '#334155',
        inputText: '#f8fafc',
        placeholder: '#94a3b8',
        buttonBackground: '#2563eb',
        buttonDisabled: '#64748b',
        link: '#93c5fd',
        toggleLabel: '#e2e8f0',
        toggleBackground: '#111827',
      }
    : {
        background: '#fff',
        subtitle: '#666',
        inputBackground: '#f8f9fa',
        inputBorder: '#e1e1e1',
        inputText: '#111827',
        placeholder: '#94a3b8',
        buttonBackground: '#007AFF',
        buttonDisabled: '#ccc',
        link: '#007AFF',
        toggleLabel: '#374151',
        toggleBackground: '#f3f4f6',
      };

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Error', 'Please enter your email/phone and password');
      return;
    }

    if (requiresOtp && !/^\d{6}$/.test(otpCode.trim())) {
      Alert.alert('Error', 'Please enter a valid 6-digit authenticator code');
      return;
    }

    setIsLoading(true);
    try {
      const payload = setupRequired
        ? { verificationId, otp: otpCode.trim() }
        : {
            identifier: identifier.trim(),
            password,
          };

      if (requiresOtp && !setupRequired) {
        payload.otp = otpCode.trim();
      }

      const result = await login(payload);
      
      if (!result.success) {
        if (result.message === 'Authenticator setup required') {
          setRequiresOtp(true);
          setSetupRequired(true);
          setVerificationId(result?.data?.verificationId || '');
          setSetupKey(result?.data?.setupKey || '');
          setOtpAuthUrl(result?.data?.otpAuthUrl || '');
          setAccountLabel(result?.data?.accountLabel || identifier.trim());
          setIssuer(result?.data?.issuer || 'BarangayConnect');
          setOtpPromptConfig({
            title: 'Set Up Authenticator',
            message: 'Scan the QR code or use the setup key, then enter your 6-digit code to finish signing in.',
            icon: '🔐',
            helper: 'You only need to complete this once for this account.',
          });
          setOtpPromptVisible(true);
          return;
        }

        if (result.message === 'Authenticator code is required') {
          setRequiresOtp(true);
          setOtpPromptConfig({
            title: 'Two-Factor Authentication',
            message: 'Enter the 6-digit code from your authenticator app to continue.',
            icon: '🔑',
            helper: 'Open Google Authenticator, Microsoft Authenticator, or Authy to get your current code.',
          });
          setOtpPromptVisible(true);
          return;
        }
        Alert.alert('Login Failed', result.message);
        if (!requiresOtp) {
          setOtpCode('');
        }
      } else {
        setRequiresOtp(false);
        setSetupRequired(false);
        setVerificationId('');
        setSetupKey('');
        setOtpAuthUrl('');
        setAccountLabel('');
        setIssuer('BarangayConnect');
        setOtpCode('');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Image
            source={require('../assets/BarangayConnect Logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
            placeholder="Email or Phone Number"
            placeholderTextColor={theme.placeholder}
            value={identifier}
            onChangeText={(value) => {
              setIdentifier(value);
              if (requiresOtp) {
                setRequiresOtp(false);
                setSetupRequired(false);
                setVerificationId('');
                setSetupKey('');
                setOtpAuthUrl('');
                setAccountLabel('');
                setIssuer('BarangayConnect');
                setOtpCode('');
              }
            }}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (requiresOtp) {
                setRequiresOtp(false);
                setSetupRequired(false);
                setVerificationId('');
                setSetupKey('');
                setOtpAuthUrl('');
                setAccountLabel('');
                setIssuer('BarangayConnect');
                setOtpCode('');
              }
            }}
            secureTextEntry
            autoCapitalize="none"
          />

          {requiresOtp && (
            <View style={[styles.otpContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#f0f9ff', borderColor: isDarkMode ? '#3b82f6' : '#0ea5e9' }]}>
              {setupRequired ? (
                <>
                  <View style={styles.otpHeader}>
                    <View style={[styles.otpIcon, { backgroundColor: isDarkMode ? '#1e40af' : '#0284c7' }]}>
                      <Text style={styles.otpIconText}>🔐</Text>
                    </View>
                    <View style={styles.otpTitleContainer}>
                      <Text style={[styles.otpMainTitle, { color: theme.inputText }]}>Secure Your Account</Text>
                      <Text style={[styles.otpSubtitle, { color: theme.subtitle }]}>Set up two-factor authentication</Text>
                    </View>
                  </View>

                  <View style={styles.stepsContainer}>
                    <View style={[styles.stepBox, { borderLeftColor: isDarkMode ? '#3b82f6' : '#0ea5e9', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }]}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: theme.inputText }]}>Scan QR Code</Text>
                        <Text style={[styles.stepDescription, { color: theme.subtitle }]}>
                          Use Google Authenticator, Microsoft Authenticator, or Authy
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.qrContainer, { backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderColor: isDarkMode ? '#334155' : '#e5e7eb' }]}>
                      {otpAuthUrl ? (
                        <View style={styles.qrWrap}>
                          <QRCode value={otpAuthUrl} size={160} backgroundColor="#ffffff" />
                        </View>
                      ) : (
                        <View style={styles.qrFallback}>
                          <Text style={styles.qrFallbackText}>QR code unavailable</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.openAuthButton, { backgroundColor: isDarkMode ? '#3b82f6' : '#0284c7' }]}
                      onPress={async () => {
                        if (!otpAuthUrl) {
                          return;
                        }
                        try {
                          await Linking.openURL(otpAuthUrl);
                        } catch (error) {
                          Alert.alert('Open Authenticator', 'Use the setup key below to add the account manually.');
                        }
                      }}
                    >
                      <Text style={styles.openAuthButtonText}>📱 Open in Authenticator App</Text>
                    </TouchableOpacity>

                    <View style={[styles.divider, { backgroundColor: isDarkMode ? '#334155' : '#e5e7eb' }]} />

                    <View style={[styles.stepBox, { borderLeftColor: isDarkMode ? '#3b82f6' : '#0ea5e9', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }]}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: theme.inputText }]}>Manual Setup</Text>
                        <Text style={[styles.stepDescription, { color: theme.subtitle }]}>
                          If scan doesn't work, enter this key manually
                        </Text>
                      </View>
                    </View>

                    <TextInput
                      style={[
                        styles.setupKeyInput,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.inputText,
                        },
                      ]}
                      value={setupKey}
                      editable={false}
                      selectTextOnFocus
                    />

                    <View style={[styles.accountInfoBox, { backgroundColor: isDarkMode ? '#0f172a' : '#f9fafb', borderColor: isDarkMode ? '#334155' : '#e5e7eb' }]}>
                      <Text style={[styles.accountInfoLabel, { color: theme.subtitle }]}>Account</Text>
                      <Text style={[styles.accountInfoValue, { color: theme.inputText }]}>{accountLabel || 'Your account'}</Text>
                      <Text style={[styles.accountInfoLabel, { color: theme.subtitle, marginTop: 8 }]}>Issuer</Text>
                      <Text style={[styles.accountInfoValue, { color: theme.inputText }]}>{issuer}</Text>
                    </View>

                    <View style={[styles.stepBox, { borderLeftColor: isDarkMode ? '#3b82f6' : '#0ea5e9', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }]}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: theme.inputText }]}>Enter Code</Text>
                        <Text style={[styles.stepDescription, { color: theme.subtitle }]}>
                          Enter the 6-digit code from your app
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TextInput
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: isDarkMode ? '#3b82f6' : '#0ea5e9',
                        color: theme.inputText,
                      },
                    ]}
                    placeholder="000000"
                    placeholderTextColor={theme.placeholder}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <View style={[styles.securityTip, { backgroundColor: isDarkMode ? '#064e3b' : '#ecfdf5', borderColor: isDarkMode ? '#059669' : '#6ee7b7' }]}>
                    <Text style={[styles.securityTipIcon]}>✓</Text>
                    <Text style={[styles.securityTipText, { color: isDarkMode ? '#a7f3d0' : '#065f46' }]}>
                      Your account is now more secure with two-factor authentication
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.otpHeader}>
                    <View style={[styles.otpIcon, { backgroundColor: isDarkMode ? '#1e40af' : '#0284c7' }]}>
                      <Text style={styles.otpIconText}>🔑</Text>
                    </View>
                    <View style={styles.otpTitleContainer}>
                      <Text style={[styles.otpMainTitle, { color: theme.inputText }]}>Two-Factor Authentication</Text>
                      <Text style={[styles.otpSubtitle, { color: theme.subtitle }]}>Enter your authenticator code to continue</Text>
                    </View>
                  </View>

                  <View style={[styles.otpInfoBox, { backgroundColor: isDarkMode ? '#0f172a' : '#f9fafb', borderColor: isDarkMode ? '#334155' : '#e5e7eb' }]}>
                    <Text style={[styles.otpInfoText, { color: theme.subtitle }]}>
                      Check your authenticator app (Google Authenticator, Microsoft Authenticator, or Authy) for your 6-digit code
                    </Text>
                  </View>

                  <TextInput
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: isDarkMode ? '#3b82f6' : '#0ea5e9',
                        color: theme.inputText,
                      },
                    ]}
                    placeholder="000000"
                    placeholderTextColor={theme.placeholder}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <View style={[styles.characterDisplay, { backgroundColor: isDarkMode ? '#0f172a' : '#f9fafb', borderColor: isDarkMode ? '#334155' : '#e5e7eb' }]}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <View key={i} style={[styles.codeCharacter, { backgroundColor: otpCode.length > i ? (isDarkMode ? '#3b82f6' : '#0ea5e9') : (isDarkMode ? '#334155' : '#e5e7eb') }]}>
                        <Text style={[styles.codeCharacterText, { color: otpCode.length > i ? '#fff' : (isDarkMode ? '#64748b' : '#9ca3af') }]}>
                          {otpCode[i] || '○'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: isLoading ? theme.buttonDisabled : theme.buttonBackground },
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Signing In...' : requiresOtp ? 'Verify & Sign In' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={[styles.linkText, { color: theme.link }]}> 
              Don't have an account? Sign Up
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { marginTop: 12 }]}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={[styles.linkText, { color: theme.link }]}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={otpPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOtpPromptVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }]}> 
            <View style={[styles.modalIconWrap, { backgroundColor: isDarkMode ? '#1e40af' : '#0284c7' }]}>
              <Text style={styles.modalIconText}>{otpPromptConfig.icon}</Text>
            </View>

            <Text style={[styles.modalTitle, { color: theme.inputText }]}>{otpPromptConfig.title}</Text>
            <Text style={[styles.modalMessage, { color: theme.subtitle }]}>{otpPromptConfig.message}</Text>

            <View style={[styles.modalInfoBox, { backgroundColor: isDarkMode ? '#111827' : '#f8fafc', borderColor: isDarkMode ? '#334155' : '#dbeafe' }]}>
              <Text style={[styles.modalInfoText, { color: theme.inputText }]}>{otpPromptConfig.helper}</Text>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: isDarkMode ? '#3b82f6' : '#0284c7' }]}
              onPress={() => setOtpPromptVisible(false)}
              activeOpacity={0.9}
            >
              <Text style={styles.modalButtonText}>Continue</Text>
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
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 20,
  },
  logoImage: {
    width: 240,
    height: 92,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
  setupBox: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  setupTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  qrFallback: {
    width: 170,
    height: 170,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFallbackText: {
    color: '#64748b',
    fontSize: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1d4ed8',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  setupKeyInput: {
    marginBottom: 8,
  },
  setupHint: {
    fontSize: 12,
    marginBottom: 4,
  },

  // Enhanced 2FA Styles
  otpContainer: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    backgroundColor: '#f0f9ff',
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  otpIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0284c7',
  },
  otpIconText: {
    fontSize: 28,
  },
  otpTitleContainer: {
    flex: 1,
  },
  otpMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#111827',
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  stepsContainer: {
    marginBottom: 16,
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
    paddingLeft: 12,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    minWidth: 32,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    color: '#111827',
  },
  stepDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  qrContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  openAuthButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  openAuthButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  setupKeyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  accountInfoBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  accountInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#666',
    letterSpacing: 0.5,
  },
  accountInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  otpInput: {
    borderWidth: 2,
    borderColor: '#0ea5e9',
    borderRadius: 10,
    padding: 14,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  otpInfoBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  otpInfoText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
  },
  characterDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  codeCharacter: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  codeCharacterText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9ca3af',
  },
  securityTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  securityTipIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  securityTipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconText: {
    fontSize: 28,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInfoBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  modalInfoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default LoginScreen;
