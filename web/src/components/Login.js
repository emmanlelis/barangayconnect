import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App as AntApp } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [pendingCredentials, setPendingCredentials] = useState({ email: '', password: '' });
  const { login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const payload = otpStep
        ? {
            email: pendingCredentials.email,
            password: pendingCredentials.password,
            otp: values.otp,
            verificationId: verificationId || undefined
          }
        : values;

      const result = await login(payload);
      if (!result.success) {
        if (result.requiresOtp) {
          setOtpStep(true);
          setSetupRequired(!!result.setupRequired);
          setVerificationId(result.verificationId || '');
          setSetupKey(result.setupKey || '');
          setOtpAuthUrl(result.otpAuthUrl || '');
          setAccountLabel(result.accountLabel || '');
          if (!otpStep) {
            setPendingCredentials({ email: values.email, password: values.password });
          }
          setError(result.message || 'Authenticator code is required');
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch (error) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AntApp>
      <div className="login-container">
        <Card className="login-card">
          <div className="login-header">
            <Title level={2}>BarangayConnect Admin</Title>
            <Text type="secondary">Login to manage complaints</Text>
          </div>
          
          <Form
            name="login"
            className="login-form"
            onFinish={onFinish}
            autoComplete="off"
          >
            {!otpStep && (
              <>
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: 'Please input your email!' },
                    { type: 'email', message: 'Please input a valid email!' }
                  ]}
                >
                  <Input 
                    prefix={<UserOutlined />} 
                    placeholder="Email" 
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[{ required: true, message: 'Please input your password!' }]}
                >
                  <Input.Password 
                    prefix={<LockOutlined />} 
                    placeholder="Password" 
                    size="large"
                  />
                </Form.Item>
              </>
            )}

            {otpStep && (
              <>
                {setupRequired && (
                  <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6 }}>
                    <Text strong>Authenticator Setup Required</Text>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">1. Add this account to your authenticator app.</Text>
                    </div>
                    <div>
                      <Text type="secondary">2. Account: {accountLabel || 'Admin Account'}</Text>
                    </div>
                    <div>
                      <Text type="secondary">3. Secret Key: </Text>
                      <Text copyable={{ text: setupKey }}>{setupKey || 'N/A'}</Text>
                    </div>
                    {otpAuthUrl ? (
                      <div>
                        <a href={otpAuthUrl} target="_blank" rel="noreferrer">Open OTP Link</a>
                      </div>
                    ) : null}
                  </div>
                )}

                <Form.Item
                  name="otp"
                  rules={[
                    { required: true, message: 'Please enter your authenticator code' },
                    { pattern: /^\d{6}$/, message: 'Code must be 6 digits' }
                  ]}
                >
                  <Input
                    prefix={<LockOutlined />}
                    placeholder="6-digit authenticator code"
                    size="large"
                    maxLength={6}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="login-button"
                loading={loading}
                block
              >
                {otpStep ? 'Verify Authenticator Code' : 'Sign In'}
              </Button>
            </Form.Item>

            {otpStep && (
              <Form.Item>
                <Button
                  block
                  onClick={() => {
                    setOtpStep(false);
                    setSetupRequired(false);
                    setVerificationId('');
                    setSetupKey('');
                    setOtpAuthUrl('');
                    setAccountLabel('');
                    setPendingCredentials({ email: '', password: '' });
                    setError('');
                  }}
                >
                  Back to Sign In
                </Button>
              </Form.Item>
            )}
          </Form>
        
        {error && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
            <Text type="danger">{error}</Text>
          </div>
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

export default Login;
