import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, message, Spin, Alert, Divider, Typography, Space, Tag } from 'antd';
import { MailOutlined, SaveOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined } from '@ant-design/icons';
import { adminAPI } from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MailSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getMailSettings();
      if (response.data.success) {
        const data = response.data.data;
        setSettings(data);
        form.setFieldsValue({
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort || '',
          smtpSecure: data.smtpSecure ?? true,
          smtpUser: data.smtpUser || '',
          smtpPass: data.smtpPass || '',
          smtpFromEmail: data.smtpFromEmail || '',
          isActive: data.isActive ?? true
        });
      }
    } catch (error) {
      message.error('Failed to load mail settings');
      console.error('Error fetching mail settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    try {
      setSaving(true);
      const response = await adminAPI.saveMailSettings(values);
      if (response.data.success) {
        message.success('Mail settings saved successfully');
        fetchSettings();
      } else {
        message.error(response.data.message || 'Failed to save mail settings');
      }
    } catch (error) {
      message.error('Failed to save mail settings');
      console.error('Error saving mail settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const values = form.getFieldsValue();
      const response = await adminAPI.testMailSettings(values);
      setTestResult(response.data);
      if (response.data.success) {
        message.success('Test email sent successfully!');
      } else {
        message.error(response.data.message || 'Failed to send test email');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Failed to test mail settings';
      setTestResult({ success: false, message: errorMsg });
      message.error('Failed to test mail settings');
      console.error('Error testing mail settings:', error);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0 }}>
            <MailOutlined style={{ marginRight: '12px' }} />
            Mail Settings
          </Title>
          <Text type="secondary">
            Configure SMTP settings for sending emails (password reset, subpoenas, notifications)
          </Text>
        </div>

        {settings?.source === 'env' && (
          <Alert
            message="Using Environment Variables"
            description="Mail settings are currently loaded from server environment variables. Save new settings to store them in the database."
            type="info"
            showIcon
            style={{ marginBottom: '24px' }}
          />
        )}

        {settings?.configured && (
          <Alert
            message={
              <span>
                Status: <Tag color={settings.isActive ? 'green' : 'orange'}>
                  {settings.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </span>
            }
            description={settings.source === 'database' 
              ? 'Settings are stored in database and will be used for sending emails.' 
              : 'Settings from environment variables will be used as fallback.'}
            type={settings.isActive ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: '24px' }}
          />
        )}

        {!settings?.configured && (
          <Alert
            message="SMTP Not Configured"
            description="Please configure SMTP settings below to enable email sending features."
            type="error"
            showIcon
            style={{ marginBottom: '24px' }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            smtpSecure: true,
            isActive: true
          }}
        >
          <Divider orientation="left">SMTP Configuration</Divider>

          <Form.Item
            label="SMTP Host"
            name="smtpHost"
            rules={[{ required: true, message: 'Please enter SMTP host' }]}
            tooltip="e.g., smtp.gmail.com, smtp.mailgun.org"
          >
            <Input placeholder="smtp.gmail.com" />
          </Form.Item>

          <Form.Item
            label="SMTP Port"
            name="smtpPort"
            rules={[
              { required: true, message: 'Please enter SMTP port' },
              { type: 'number', min: 1, max: 65535, message: 'Port must be between 1 and 65535' }
            ]}
            tooltip="Typically 587 (TLS) or 465 (SSL)"
          >
            <Input type="number" placeholder="587" style={{ width: '150px' }} />
          </Form.Item>

          <Form.Item
            label="Use SSL/TLS (Port 465)"
            name="smtpSecure"
            valuePropName="checked"
            tooltip="Enable for port 465, disable for port 587"
          >
            <Switch />
          </Form.Item>

          <Divider orientation="left">Authentication</Divider>

          <Form.Item
            label="SMTP Username / Email"
            name="smtpUser"
            rules={[{ required: true, message: 'Please enter SMTP username or email' }]}
            tooltip="Your email address or app-specific username"
          >
            <Input placeholder="your-email@gmail.com" />
          </Form.Item>

          <Form.Item
            label="SMTP Password / App Password"
            name="smtpPass"
            rules={[{ required: true, message: 'Please enter SMTP password' }]}
            tooltip="For Gmail, use an App Password (16 characters)"
          >
            <Input.Password placeholder="Enter password or app password" />
          </Form.Item>

          <Form.Item
            label="From Email Address"
            name="smtpFromEmail"
            rules={[
              { required: true, message: 'Please enter from email' },
              { type: 'email', message: 'Please enter a valid email address' }
            ]}
            tooltip="The email address that will appear in the 'From' field"
          >
            <Input placeholder="noreply@barangayconnect.com" />
          </Form.Item>

          <Divider orientation="left">Settings</Divider>

          <Form.Item
            label="Use Database Settings"
            name="isActive"
            valuePropName="checked"
            tooltip="When enabled, database settings take priority over environment variables"
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />}
                loading={saving}
              >
                Save Settings
              </Button>
              <Button 
                icon={<SendOutlined />}
                onClick={handleTest}
                loading={testing}
                disabled={!form.getFieldValue('smtpHost') || !form.getFieldValue('smtpUser')}
              >
                Send Test Email
              </Button>
            </Space>
          </Form.Item>

          {testResult && (
            <Alert
              message={testResult.success ? 'Test Successful' : 'Test Failed'}
              description={testResult.success 
                ? 'Test email was sent successfully. Check your inbox.' 
                : testResult.message || 'Failed to send test email.'}
              type={testResult.success ? 'success' : 'error'}
              showIcon
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              style={{ marginTop: '16px' }}
            />
          )}
        </Form>
      </Card>
    </div>
  );
};

export default MailSettings;