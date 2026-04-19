import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App as AntApp } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const result = await login(values);
      if (!result.success) {
        setError(result.error || 'Login failed');
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

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="login-button"
                loading={loading}
                block
              >
                Sign In
              </Button>
            </Form.Item>
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
