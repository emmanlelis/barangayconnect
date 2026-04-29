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
} from 'react-native';
import { authAPI } from '../services/api';

const ForgotPasswordScreen = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [step, setStep] = useState('request');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestCode = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or phone number');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authAPI.forgotPassword(identifier.trim());
      if (result?.data?.verificationId) {
        setVerificationId(result.data.verificationId);
      }

      if (result?.data?.debugResetCode) {
        Alert.alert('Dev reset code', `${result.data.debugResetCode}\n\n${result.data.debugMessage || 'Use this code to continue.'}`);
      } else {
        Alert.alert('Reset Code Sent', 'Check your email for the reset code.');
      }

      setStep('reset');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to request reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!identifier.trim() || !resetCode.trim() || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authAPI.resetPassword({
        identifier: identifier.trim(),
        code: resetCode.trim(),
        newPassword,
        confirmPassword,
        verificationId,
      });

      if (result?.success) {
        Alert.alert('Success', 'Your password has been reset.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Error', result?.message || 'Unable to reset password');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Image
            source={require('../assets/BarangayConnect Logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>We will send a reset code to your email. If the account has no email on file, please contact an administrator.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email or Phone Number"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {step === 'reset' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Reset Code"
                value={resetCode}
                onChangeText={setResetCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </>
          )}

          {step === 'request' ? (
            <TouchableOpacity style={styles.button} onPress={handleRequestCode} disabled={isLoading}>
              <Text style={styles.buttonText}>{isLoading ? 'Sending...' : 'Send Reset Code'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={isLoading}>
              <Text style={styles.buttonText}>{isLoading ? 'Resetting...' : 'Reset Password'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  header: { alignItems: 'center', marginBottom: 28 },
  logoImage: { width: 240, height: 92, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 6, textAlign: 'center' },
  form: { width: '100%' },
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
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center' },
  linkText: { fontSize: 14, color: '#007AFF' },
});

export default ForgotPasswordScreen;