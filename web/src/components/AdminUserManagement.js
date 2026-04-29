import React, { useState } from 'react';
import { Card, Typography, Descriptions, Form, Input, Button, message, Row, Col } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

const { Title, Text } = Typography;

const AdminUserManagement = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (values) => {
    try {
      setSubmitting(true);
      const response = await authAPI.changeAdminPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
        otp: values.otp
      });

      if (response.data.success) {
        message.success('Admin password changed successfully');
        form.resetFields();
      } else {
        message.error(response.data.message || 'Failed to change password');
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Title level={2}>
            <UserOutlined /> Admin User Management
          </Title>
          <Text type="secondary">
            Manage admin account credentials and reset your admin password.
          </Text>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Admin Account Details">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Name">
                {(user?.firstName || '') + ' ' + (user?.lastName || '')}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {user?.email || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {user?.phoneNumber || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Position">
                {user?.position || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Department">
                {user?.department || 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Reset Admin Password">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleChangePassword}
              autoComplete="off"
            >
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: 'Please enter your current password' }]}
              >
                <Input.Password placeholder="Enter current password" />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: 'Please enter a new password' },
                  { min: 6, message: 'Password must be at least 6 characters' }
                ]}
              >
                <Input.Password placeholder="Enter new password" />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Please confirm your new password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    }
                  })
                ]}
              >
                <Input.Password placeholder="Confirm new password" />
              </Form.Item>

              <Form.Item
                name="otp"
                label="Authenticator Code"
                rules={[
                  { required: true, message: 'Please enter your authenticator code' },
                  { pattern: /^\d{6}$/, message: 'Code must be 6 digits' }
                ]}
              >
                <Input placeholder="Enter 6-digit code" maxLength={6} />
              </Form.Item>

              <Button
                type="primary"
                icon={<LockOutlined />}
                htmlType="submit"
                loading={submitting}
                block
              >
                Update Password
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminUserManagement;
