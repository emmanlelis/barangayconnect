import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App as AntApp, Spin } from 'antd';
import { MailOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import api from '../services/api';
import './Login.css';

const { Title, Text } = Typography;

const ForgotPassword = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: email, 2: code+password
  const [email, setEmail] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [form] = Form.useForm();

  const onRequestReset = async (values) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/forgot-password', {
        identifier: values.email
      });

      if (response.data.success || response.data.data?.verificationId) {
        setEmail(values.email);
        setVerificationId(response.data.data?.verificationId);
        setStep(2);
        setSuccessMessage(
          response.data.data?.debugResetCode
            ? `Debug Code: ${response.data.data.debugResetCode}`
            : 'Password reset code sent to your email'
        );
        form.resetFields();
      } else {
        setError(response.data.message || 'Failed to request reset code');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request reset code');
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (values) => {
    setLoading(true);
    setError('');
    try {
      if (values.newPassword !== values.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const response = await api.post('/auth/reset-password', {
        identifier: email,
        code: values.code,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword
      });

      if (response.data.success) {
        setSuccessMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          onBack();
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AntApp>
      <div className="login-container">
        <Card className="login-card">
          <div className="login-header">
            <Title level={2}>Reset Admin Password</Title>
            <Text type="secondary">
              {step === 1 ? 'Enter your email to receive a reset code' : 'Enter the reset code and new password'}
            </Text>
          </div>

          {successMessage && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
              <Text type="success">{successMessage}</Text>
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
              <Text type="danger">{error}</Text>
            </div>
          )}

          {step === 1 ? (
            <Form
              form={form}
              onFinish={onRequestReset}
              autoComplete="off"
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="Admin Email"
                  size="large"
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="login-button"
                >
                  Send Reset Code
                </Button>
              </Form.Item>

              <Form.Item>
                <Button
                  block
                  icon={<ArrowLeftOutlined />}
                  onClick={onBack}
                  disabled={loading}
                >
                  Back to Login
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <Form
              form={form}
              onFinish={onResetPassword}
              autoComplete="off"
            >
              <Form.Item
                name="code"
                rules={[
                  { required: true, message: 'Please enter the reset code' },
                  { pattern: /^\d{6}$/, message: 'Code must be 6 digits' }
                ]}
              >
                <Input
                  prefix={<LockOutlined />}
                  placeholder="6-digit reset code"
                  size="large"
                  maxLength={6}
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                rules={[
                  { required: true, message: 'Please enter your new password' },
                  { min: 6, message: 'Password must be at least 6 characters' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="New Password"
                  size="large"
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                rules={[
                  { required: true, message: 'Please confirm your password' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Confirm Password"
                  size="large"
                  disabled={loading}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="login-button"
                >
                  Reset Password
                </Button>
              </Form.Item>

              <Form.Item>
                <Button
                  block
                  icon={<ArrowLeftOutlined />}
                  onClick={() => {
                    setStep(1);
                    setError('');
                    setSuccessMessage('');
                    form.resetFields();
                  }}
                  disabled={loading}
                >
                  Back
                </Button>
              </Form.Item>
            </Form>
          )}

          <div className="login-footer">
            <Text type="secondary">
              For barangay officials only
            </Text>
          </div>
        </Card>
      </div>
    </AntApp>
  );
};

export default ForgotPassword;
