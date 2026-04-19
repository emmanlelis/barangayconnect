import React, { useState, useEffect } from 'react';
import { Card, Typography, List, Badge, Button, Space, Tag, Empty, Spin } from 'antd';
import { BellOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { adminAPI } from '../services/api';

const { Title, Text } = Typography;

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    // Simulate real-time updates
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await adminAPI.getNotifications();
      if (response.data.success) {
        setNotifications(response.data.data);
        const unread = response.data.data.filter(n => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await adminAPI.markNotificationRead(notificationId);
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const clearAll = async () => {
    try {
      await adminAPI.clearAllNotifications();
      loadNotifications();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'complaint_submitted':
        return <BellOutlined style={{ color: '#1890ff' }} />;
      case 'complaint_updated':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'complaint_resolved':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'complaint_urgent':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <BellOutlined />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'complaint_submitted':
        return 'blue';
      case 'complaint_updated':
        return 'green';
      case 'complaint_resolved':
        return 'green';
      case 'complaint_urgent':
        return 'red';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2}>Notifications</Title>
        <Badge count={unreadCount} size="small">
          <BellOutlined style={{ fontSize: 20 }} />
        </Badge>
        <Button 
          type="primary" 
          size="small"
          onClick={clearAll}
          disabled={notifications.length === 0}
        >
          Clear All
        </Button>
      </div>
      
      <Card>
        {notifications.length === 0 ? (
          <Empty 
            description="No new notifications"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                style={{ 
                  cursor: 'pointer',
                  backgroundColor: item.read ? 'transparent' : '#f6f8ff',
                  padding: '12px 16px'
                }}
                onClick={() => !item.read && markAsRead(item._id)}
              >
                <List.Item.Meta
                  avatar={getNotificationIcon(item.type)}
                  title={
                    <div>
                      <Text strong>{item.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </div>
                  }
                  description={item.message}
                />
                {!item.read && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    New
                  </Tag>
                )}
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default Notifications;
