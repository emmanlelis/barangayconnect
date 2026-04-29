import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, 
  Card, 
  Avatar,
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Upload,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Spin
} from 'antd';
import { 
  UserOutlined, 
  EyeOutlined,
  EditOutlined, 
  DeleteOutlined,
  CameraOutlined,
  UploadOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { adminAPI } from '../services/api';

const { Title, Text } = Typography;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userSection, setUserSection] = useState('active');
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [hardDeleteModalVisible, setHardDeleteModalVisible] = useState(false);
  const [hardDeletePassword, setHardDeletePassword] = useState('');
  const [hardDeleting, setHardDeleting] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [editProfilePictureUrl, setEditProfilePictureUrl] = useState('');
  const [profileUploading, setProfileUploading] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraTarget, setCameraTarget] = useState('create');
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [resetPasswordForm] = Form.useForm();
  const [stats, setStats] = useState({});
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  useEffect(() => {
    loadUsers({ page: 1 });
    loadStats();
  }, [userSection]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const normalizedSearch = searchText.trim();
      loadUsers({ page: 1, search: normalizedSearch });
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  const loadUsers = async (options = {}) => {
    try {
      setLoading(true);
      const page = options.page ?? pagination.current;
      const pageSize = options.pageSize ?? pagination.pageSize;
      const search = options.search ?? searchText;
      const normalizedSearch = typeof search === 'string' ? search.trim() : '';

      const response = await adminAPI.getUsers({
        page,
        limit: pageSize,
        search: normalizedSearch || undefined,
        filterType: userSection === 'recently-deleted' ? 'recently-deleted' : 'active'
      });

      if (response.data.success) {
        const usersData = response.data.data.users || [];
        const serverPagination = response.data.data.pagination || {};

        setUsers(usersData);
        setPagination((prev) => ({
          ...prev,
          current: serverPagination.current || page,
          pageSize,
          total: serverPagination.count || usersData.length,
        }));
      }
    } catch (error) {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await adminAPI.getUserStats();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleStatusToggle = async (userId, isActive) => {
    try {
      const response = await adminAPI.updateUserStatus(userId, { isActive });
      if (response.data.success) {
        message.success(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
        loadUsers();
        loadStats();
      }
    } catch (error) {
      message.error('Failed to update user status');
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditProfilePictureUrl(user.profilePicture || '');
    form.setFieldsValue({
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      street: user.address?.street,
      purok: user.address?.purok,
      barangay: user.address?.barangay,
      city: user.address?.city,
      province: user.address?.province,
      zipCode: user.address?.zipCode,
      password: undefined
    });
    setModalVisible(true);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setViewModalVisible(true);
  };

  const handleUpdateUser = async (values) => {
    try {
      const payload = {
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        address: {
          street: values.street,
          purok: values.purok,
          barangay: values.barangay,
          city: values.city,
          province: values.province,
          zipCode: values.zipCode
        },
        profilePicture: editProfilePictureUrl || null
      };

      if (values.password) {
        payload.password = values.password;
      }

      const response = await adminAPI.updateUser(selectedUser._id, payload);
      if (response.data.success) {
        message.success('User updated successfully');
        setModalVisible(false);
        loadUsers();
        setSelectedUser(null);
        setEditProfilePictureUrl('');
        form.resetFields();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleCreateUser = async (values) => {
    try {
      setCreateLoading(true);

      const payload = {
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        password: values.password,
        address: {
          street: values.street,
          purok: values.purok,
          barangay: values.barangay,
          city: values.city,
          province: values.province,
          zipCode: values.zipCode
        },
        profilePicture: profilePictureUrl || undefined
      };

      const response = await adminAPI.createUser(payload);
      if (response.data.success) {
        message.success('Citizen user created successfully');
        setCreateModalVisible(false);
        createForm.resetFields();
        setProfilePictureUrl('');
        loadUsers();
        loadStats();
      } else {
        message.error(response.data.message || 'Failed to create citizen user');
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to create citizen user');
    } finally {
      setCreateLoading(false);
    }
  };

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  };

  const uploadProfileImageFile = async (file, target = 'create') => {
    setProfileUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file, file.name || 'profile-photo.jpg');

      const response = await adminAPI.uploadSingleImage(formData);
      const imageUrl = response.data?.data?.image?.url;

      if (!imageUrl) {
        throw new Error('No image URL returned from upload');
      }

      if (target === 'edit') {
        setEditProfilePictureUrl(imageUrl);
      } else {
        setProfilePictureUrl(imageUrl);
      }
      message.success('Profile picture uploaded');
    } catch (error) {
      message.error(error.response?.data?.message || error.message || 'Failed to upload profile picture');
    } finally {
      setProfileUploading(false);
    }
  };

  const handleOpenCamera = async (target = 'create') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraTarget(target);
      cameraStreamRef.current = stream;
      setCameraModalVisible(true);
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play();
        }
      }, 0);
    } catch (error) {
      message.error('Unable to access camera. Please allow camera permission.');
    }
  };

  const handleCapturePhoto = async () => {
    if (!cameraVideoRef.current) {
      return;
    }

    const video = cameraVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext('2d');
    if (!context) {
      message.error('Unable to capture photo');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        message.error('Unable to capture photo');
        return;
      }

      const capturedFile = new File([blob], `camera-profile-${Date.now()}.jpg`, { type: 'image/jpeg' });
      await uploadProfileImageFile(capturedFile, cameraTarget);
      stopCameraStream();
      setCameraModalVisible(false);
    }, 'image/jpeg', 0.9);
  };

  const handleDeleteUser = (userId) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this user?',
      content: 'This action cannot be undone.',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          const response = await adminAPI.deleteUser(userId);
          if (response.data.success) {
            message.success('User deleted successfully');
            loadUsers();
            loadStats();
          }
        } catch (error) {
          message.error('Failed to delete user');
        }
      },
    });
  };

  const handleRecoverUser = async (userId) => {
    try {
      const response = await adminAPI.recoverUser(userId);
      if (response.data.success) {
        message.success('User recovered successfully');
        loadUsers();
        loadStats();
      } else {
        message.error(response.data.message || 'Failed to recover user');
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to recover user');
    }
  };

  const handleOpenResetPassword = (user) => {
    setSelectedUser(user);
    resetPasswordForm.resetFields();
    setResetPasswordModalVisible(true);
  };

  const handleResetPassword = async (values) => {
    if (!selectedUser?._id) {
      message.error('No user selected');
      return;
    }

    try {
      setResetPasswordLoading(true);
      const response = await adminAPI.resetUserPassword(selectedUser._id, {
        password: values.password,
        otp: values.otp
      });

      if (response.data.success) {
        message.success('Password reset successfully');
        setResetPasswordModalVisible(false);
        resetPasswordForm.resetFields();
      } else {
        message.error(response.data.message || 'Failed to reset password');
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const columns = [
    {
      title: 'Profile',
      dataIndex: 'profilePicture',
      key: 'profilePicture',
      width: 90,
      render: (profilePicture) => (
        <Avatar
          size={40}
          src={profilePicture || undefined}
          icon={<UserOutlined />}
        />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => `${record.firstName} ${record.lastName}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
    },
    {
      title: 'Barangay',
      dataIndex: ['address', 'barangay'],
      key: 'barangay',
      render: (_, record) => record.address?.barangay || 'N/A',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (isActive, record) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Deleted At',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
      responsive: ['md'],
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewUser(record)}
          >
            View
          </Button>
          {userSection !== 'recently-deleted' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditUser(record)}
              >
                Edit
              </Button>
              <Button
                type={record.isActive ? 'default' : 'primary'}
                size="small"
                icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />}
                onClick={() => handleStatusToggle(record._id, !record.isActive)}
              >
                {record.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                type="default"
                size="small"
                onClick={() => handleOpenResetPassword(record)}
              >
                Reset Password
              </Button>
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteUser(record._id)}
              >
                Delete
              </Button>
            </>
          )}
          {userSection === 'recently-deleted' && (
            <>
              <Button
                type="primary"
                size="small"
                onClick={() => handleRecoverUser(record._id)}
              >
                Recover
              </Button>
              <Button
                type="danger"
                size="small"
                onClick={() => {
                  setSelectedUser(record);
                  setHardDeletePassword('');
                  setHardDeleteModalVisible(true);
                }}
              >
                Permanently Delete
              </Button>
              <Tag color="orange">Auto delete after 30 days</Tag>
            </>
          )}
        </Space>
      ),
    },
  ];

  const displayedColumns = userSection === 'recently-deleted'
    ? columns.filter((column) => column.key !== 'status')
    : columns.filter((column) => column.key !== 'deletedAt');

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
        <Title level={2} style={{ marginBottom: 0 }}>User Management</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            createForm.resetFields();
            setProfilePictureUrl('');
            setCreateModalVisible(true);
          }}
        >
          Add New Citizen
        </Button>
      </div>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.totalUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={stats.activeUsers || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="New Users (30 days)"
              value={stats.newUsers30Days || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Users Today"
              value={stats.usersToday || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Button
            type={userSection === 'active' ? 'primary' : 'default'}
            onClick={() => {
              setUserSection('active');
              setSearchText('');
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
          >
            Active Users
          </Button>
          <Button
            type={userSection === 'recently-deleted' ? 'primary' : 'default'}
            onClick={() => {
              setUserSection('recently-deleted');
              setSearchText('');
              setPagination((prev) => ({ ...prev, current: 1 }));
            }}
          >
            Recently Deleted Users
          </Button>
        </div>

        <div style={{ marginBottom: 16, maxWidth: 420 }}>
          <Input.Search
            allowClear
            placeholder="Search name, email, or phone"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => {
              const normalizedSearch = value.trim();
              setSearchText(normalizedSearch);
              loadUsers({ page: 1, search: normalizedSearch });
            }}
          />
        </div>

        {userSection === 'recently-deleted' && (
          <div style={{ marginBottom: 12 }}>
            <Tag color="red">Users in this section are permanently deleted after 30 days.</Tag>
          </div>
        )}

        <Table
          columns={displayedColumns}
          dataSource={users}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            onChange: (page, pageSize) => {
              loadUsers({ page, pageSize });
            },
          }}
        />
      </Card>

      <Modal
        title="Edit User"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedUser(null);
          setEditProfilePictureUrl('');
          form.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setModalVisible(false);
            setSelectedUser(null);
            setEditProfilePictureUrl('');
            form.resetFields();
          }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            Update
          </Button>,
        ]}
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateUser}
        >
          <Form.Item label="Profile Picture">
            <Space align="start" wrap>
              <Upload
                showUploadList={false}
                accept="image/*"
                beforeUpload={async (file) => {
                  await uploadProfileImageFile(file, 'edit');
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={profileUploading}>
                  Upload Photo
                </Button>
              </Upload>

              <Button icon={<CameraOutlined />} onClick={() => handleOpenCamera('edit')}>
                Use Camera
              </Button>

              {editProfilePictureUrl && (
                <img
                  src={editProfilePictureUrl}
                  alt="Profile Preview"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid #f0f0f0' }}
                />
              )}
            </Space>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Please input first name' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="middleName"
                label="Middle Name"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Please input last name' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phoneNumber"
                label="Phone Number"
                rules={[{ required: true, message: 'Please input phone number' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Please input a valid email' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="password"
            label="New Password (Optional)"
            rules={[{ min: 6, message: 'Password must be at least 6 characters' }]}
          >
            <Input.Password placeholder="Leave blank to keep current password" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="street" label="Street">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purok" label="Purok" rules={[{ required: true, message: 'Please input purok' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="barangay" label="Barangay" rules={[{ required: true, message: 'Please input barangay' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="City" rules={[{ required: true, message: 'Please input city' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="province" label="Province" rules={[{ required: true, message: 'Please input province' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="zipCode" label="Zip Code">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Reset User Password"
        open={resetPasswordModalVisible}
        onCancel={() => {
          setResetPasswordModalVisible(false);
          resetPasswordForm.resetFields();
          setSelectedUser(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setResetPasswordModalVisible(false);
            resetPasswordForm.resetFields();
            setSelectedUser(null);
          }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={resetPasswordLoading} onClick={() => resetPasswordForm.submit()}>
            Reset Password
          </Button>
        ]}
      >
        <p style={{ marginBottom: 12 }}>
          Reset password for <strong>{selectedUser?.email || 'selected user'}</strong>.
        </p>
        <Form
          form={resetPasswordForm}
          layout="vertical"
          onFinish={handleResetPassword}
        >
          <Form.Item
            name="password"
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
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm the new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
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
        </Form>
      </Modal>

      <Modal
        title="Permanently Delete User"
        open={hardDeleteModalVisible}
        onCancel={() => {
          setHardDeleteModalVisible(false);
          setSelectedUser(null);
          setHardDeletePassword('');
        }}
        footer={[
          <Button key="cancel" onClick={() => { setHardDeleteModalVisible(false); setSelectedUser(null); setHardDeletePassword(''); }}>Cancel</Button>,
          <Button key="delete" type="primary" danger loading={hardDeleting} onClick={async () => {
            if (!hardDeletePassword) { message.error('Please enter your admin password'); return; }
            try {
              setHardDeleting(true);
              const response = await adminAPI.hardDeleteUser(selectedUser._id, { password: hardDeletePassword });
              if (response.data.success) {
                message.success('User permanently deleted');
                setHardDeleteModalVisible(false);
                setSelectedUser(null);
                setHardDeletePassword('');
                loadUsers();
                loadStats();
              } else {
                message.error(response.data.message || 'Failed to permanently delete user');
              }
            } catch (error) {
              message.error(error.response?.data?.message || error.message || 'Failed to permanently delete user');
            } finally {
              setHardDeleting(false);
            }
          }}>Permanently Delete</Button>
        ]}
      >
        <div>
          <p>Type your admin password to confirm permanent deletion of <strong>{selectedUser?.email}</strong>. This action cannot be undone.</p>
          <Input.Password value={hardDeletePassword} onChange={(e) => setHardDeletePassword(e.target.value)} placeholder="Admin password" />
        </div>
      </Modal>

      <Modal
        title="User Details"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedUser(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewModalVisible(false);
            setSelectedUser(null);
          }}>
            Close
          </Button>
        ]}
      >
        {selectedUser && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Avatar
                size={88}
                src={selectedUser.profilePicture || undefined}
                icon={<UserOutlined />}
              />
            </div>
            <p><strong>Name:</strong> {selectedUser.firstName} {selectedUser.middleName ? `${selectedUser.middleName} ` : ''}{selectedUser.lastName}</p>
            <p><strong>Email:</strong> {selectedUser.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {selectedUser.phoneNumber || 'N/A'}</p>
            <p><strong>Street:</strong> {selectedUser.address?.street || 'N/A'}</p>
            <p><strong>Purok:</strong> {selectedUser.address?.purok || 'N/A'}</p>
            <p><strong>Barangay:</strong> {selectedUser.address?.barangay || 'N/A'}</p>
            <p><strong>City:</strong> {selectedUser.address?.city || 'N/A'}</p>
            <p><strong>Province:</strong> {selectedUser.address?.province || 'N/A'}</p>
            <p><strong>Zip Code:</strong> {selectedUser.address?.zipCode || 'N/A'}</p>
            <p>
              <strong>Status:</strong>{' '}
              <Tag color={selectedUser.isDeleted ? 'red' : (selectedUser.isActive ? 'green' : 'orange')}>
                {selectedUser.isDeleted ? 'Recently Deleted' : (selectedUser.isActive ? 'Active' : 'Inactive')}
              </Tag>
            </p>
            <p><strong>Joined:</strong> {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A'}</p>
            {selectedUser.deletedAt && (
              <p><strong>Deleted At:</strong> {new Date(selectedUser.deletedAt).toLocaleString()}</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="Add New Citizen User"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
          setProfilePictureUrl('');
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setCreateModalVisible(false);
            createForm.resetFields();
            setProfilePictureUrl('');
          }}>
            Cancel
          </Button>,
          <Button key="create" type="primary" loading={createLoading} onClick={() => createForm.submit()}>
            Create User
          </Button>
        ]}
        width={720}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
        >
          <Form.Item label="Profile Picture">
            <Space align="start" wrap>
              <Upload
                showUploadList={false}
                accept="image/*"
                beforeUpload={async (file) => {
                  await uploadProfileImageFile(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={profileUploading}>
                  Upload Photo
                </Button>
              </Upload>

              <Button icon={<CameraOutlined />} onClick={handleOpenCamera}>
                Use Camera
              </Button>

              {profilePictureUrl && (
                <img
                  src={profilePictureUrl}
                  alt="Profile Preview"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid #f0f0f0' }}
                />
              )}
            </Space>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Please input first name' }]}
              >
                <Input placeholder="Juan" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="middleName"
                label="Middle Name"
              >
                <Input placeholder="Santos" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Please input last name' }]}
              >
                <Input placeholder="Dela Cruz" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phoneNumber"
                label="Phone Number"
                rules={[{ required: true, message: 'Please input phone number' }]}
              >
                <Input placeholder="09123456789" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input placeholder="citizen@example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please input password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password placeholder="Enter password" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="street"
                label="Street"
              >
                <Input placeholder="Street address" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="purok"
                label="Purok"
                rules={[{ required: true, message: 'Please input purok' }]}
              >
                <Input placeholder="Purok/Sitio" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="barangay"
                label="Barangay"
                rules={[{ required: true, message: 'Please input barangay' }]}
              >
                <Input placeholder="Barangay" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="city"
                label="City"
                rules={[{ required: true, message: 'Please input city' }]}
              >
                <Input placeholder="City" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="province"
                label="Province"
                rules={[{ required: true, message: 'Please input province' }]}
              >
                <Input placeholder="Province" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="zipCode"
                label="Zip Code"
              >
                <Input placeholder="Zip Code" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Capture Profile Photo"
        open={cameraModalVisible}
        onCancel={() => {
          stopCameraStream();
          setCameraModalVisible(false);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              stopCameraStream();
              setCameraModalVisible(false);
            }}
          >
            Cancel
          </Button>,
          <Button key="capture" type="primary" onClick={handleCapturePhoto}>
            Capture
          </Button>
        ]}
      >
        <video
          ref={cameraVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', borderRadius: 8, background: '#000' }}
        />
      </Modal>
    </div>
  );
};

export default UserManagement;
