import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Input, Select, message, Modal, Form, Switch, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { adminAPI } from '../services/api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    page: 1,
    limit: 10
  });
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getUsers(filters);
      if (response.data.success) {
        setUsers(response.data.data.users);
      }
    } catch (error) {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusUpdate = async (userId, isActive) => {
    try {
      const response = await adminAPI.updateUserStatus(userId, { isActive });
      if (response.data.success) {
        message.success(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
        loadUsers();
      } else {
        message.error(response.data.message || 'Failed to update user status');
      }
    } catch (error) {
      message.error('Failed to update user status');
    }
  };

  const showUserDetails = (user) => {
    setSelectedUser(user);
    setIsEditMode(false);
    setUserModalVisible(true);
    form.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      barangay: user.address?.barangay,
      city: user.address?.city,
      purok: user.address?.purok,
    });
  };

  const handleEditUser = async (values) => {
    try {
      setEditLoading(true);
      const updateData = {
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        address: {
          barangay: values.barangay,
          city: values.city,
          purok: values.purok,
        },
      };

      const response = await adminAPI.updateUser(selectedUser._id, updateData);
      if (response.data.success) {
        message.success('User updated successfully');
        setUserModalVisible(false);
        setIsEditMode(false);
        form.resetFields();
        loadUsers();
      } else {
        message.error(response.data.message || 'Failed to update user');
      }
    } catch (error) {
      message.error('Failed to update user');
      console.error('Update error:', error);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await adminAPI.deleteUser(userId);
      if (response.data.success) {
        message.success('User deleted successfully');
        setUserModalVisible(false);
        loadUsers();
      } else {
        message.error(response.data.message || 'Failed to delete user');
      }
    } catch (error) {
      message.error('Failed to delete user');
      console.error('Delete error:', error);
    }
  };

  const handleAddUser = async (values) => {
    try {
      setAddLoading(true);
      const addData = {
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
          zipCode: values.zipCode,
        },
      };

      const response = await adminAPI.createUser(addData);
      if (response.data.success) {
        message.success('User created successfully');
        setIsAddMode(false);
        addForm.resetFields();
        loadUsers();
      } else {
        message.error(response.data.message || 'Failed to create user');
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to create user');
      console.error('Add user error:', error);
    } finally {
      setAddLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'firstName',
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
      dataIndex: 'address',
      key: 'barangay',
      render: (address) => address?.barangay || 'N/A',
    },
    {
      title: 'City',
      dataIndex: 'address',
      key: 'city',
      render: (address) => address?.city || 'N/A',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Verified',
      dataIndex: 'isVerified',
      key: 'verified',
      render: (isVerified) => (
        <Tag color={isVerified ? 'blue' : 'default'}>
          {isVerified ? 'Verified' : 'Not Verified'}
        </Tag>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => showUserDetails(record)}
          >
            View
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setSelectedUser(record);
              setIsEditMode(true);
              setUserModalVisible(true);
              form.setFieldsValue({
                firstName: record.firstName,
                lastName: record.lastName,
                email: record.email,
                phoneNumber: record.phoneNumber,
                barangay: record.address?.barangay,
                city: record.address?.city,
                purok: record.address?.purok,
              });
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete User"
            description="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record._id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              Delete
            </Button>
          </Popconfirm>
          <Switch
            checked={record.isActive}
            onChange={(checked) => handleUserStatusUpdate(record._id, checked)}
            checkedChildren="Active"
            unCheckedChildren="Inactive"
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search users..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            style={{ width: 200 }}
          />
          <Button onClick={loadUsers} loading={loading}>
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setIsAddMode(true);
              addForm.resetFields();
            }}
          >
            Add New User
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.limit,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        scroll={{ x: 1000 }}
      />

      {/* User Details Modal */}
      <Modal
        title={isEditMode ? "Edit User" : "User Details"}
        open={userModalVisible}
        onCancel={() => {
          setUserModalVisible(false);
          setIsEditMode(false);
          form.resetFields();
        }}
        footer={
          isEditMode ? [
            <Button key="cancel" onClick={() => {
              setUserModalVisible(false);
              setIsEditMode(false);
              form.resetFields();
            }}>
              Cancel
            </Button>,
            <Button key="submit" type="primary" loading={editLoading} onClick={() => form.submit()}>
              Save Changes
            </Button>,
          ] : [
            <Button 
              key="edit"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setIsEditMode(true)}
            >
              Edit
            </Button>,
            <Button key="close" onClick={() => setUserModalVisible(false)}>
              Close
            </Button>,
          ]
        }
        width={600}
      >
        {isEditMode ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleEditUser}
          >
            <Form.Item
              label="First Name"
              name="firstName"
              rules={[{ required: true, message: 'First name is required' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Last Name"
              name="lastName"
              rules={[{ required: true, message: 'Last name is required' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
            >
              <Input disabled />
            </Form.Item>
            <Form.Item
              label="Phone Number"
              name="phoneNumber"
              rules={[{ required: true, message: 'Phone number is required' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Barangay"
              name="barangay"
              rules={[{ required: true, message: 'Barangay is required' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="City"
              name="city"
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Purok"
              name="purok"
            >
              <Input />
            </Form.Item>
          </Form>
        ) : (
          selectedUser && (
            <div>
              <p><strong>Name:</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p><strong>Phone:</strong> {selectedUser.phoneNumber}</p>
              <p><strong>Address:</strong> {selectedUser.address?.barangay}, {selectedUser.address?.city}</p>
              {selectedUser.address?.purok && (
                <p><strong>Purok:</strong> {selectedUser.address.purok}</p>
              )}
              <p><strong>Joined:</strong> {new Date(selectedUser.createdAt).toLocaleString()}</p>
              <p><strong>Status:</strong> 
                <Tag color={selectedUser.isActive ? 'green' : 'red'}>
                  {selectedUser.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </p>
              <p><strong>Verified:</strong> 
                <Tag color={selectedUser.isVerified ? 'blue' : 'default'}>
                  {selectedUser.isVerified ? 'Verified' : 'Not Verified'}
                </Tag>
              </p>
              {selectedUser.complaints && (
                <p><strong>Total Complaints:</strong> {selectedUser.complaints.length}</p>
              )}
            </div>
          )
        )}
      </Modal>

      {/* Add New User Modal */}
      <Modal
        title="Add New Resident User"
        open={isAddMode}
        onCancel={() => {
          setIsAddMode(false);
          addForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsAddMode(false);
            addForm.resetFields();
          }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={addLoading} onClick={() => addForm.submit()}>
            Create User
          </Button>,
        ]}
        width={700}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddUser}
        >
          <Form.Item label="Personal Information" style={{ marginBottom: 0 }}></Form.Item>
          
          <Form.Item
            label="First Name"
            name="firstName"
            rules={[{ required: true, message: 'First name is required' }]}
          >
            <Input placeholder="Juan" />
          </Form.Item>

          <Form.Item
            label="Middle Name"
            name="middleName"
          >
            <Input placeholder="Santos" />
          </Form.Item>

          <Form.Item
            label="Last Name"
            name="lastName"
            rules={[{ required: true, message: 'Last name is required' }]}
          >
            <Input placeholder="Dela Cruz" />
          </Form.Item>

          <Form.Item
            label="Phone Number"
            name="phoneNumber"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <Input placeholder="09123456789" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'Password must be at least 6 characters' }]}
          >
            <Input.Password placeholder="Enter a password" />
          </Form.Item>

          <Form.Item label="Address Information" style={{ marginBottom: 0 }}></Form.Item>

          <Form.Item
            label="Street"
            name="street"
          >
            <Input placeholder="Street address" />
          </Form.Item>

          <Form.Item
            label="Purok"
            name="purok"
            rules={[{ required: true, message: 'Purok is required' }]}
          >
            <Input placeholder="Purok 1" />
          </Form.Item>

          <Form.Item
            label="Barangay"
            name="barangay"
            rules={[{ required: true, message: 'Barangay is required' }]}
          >
            <Input placeholder="Barangay name" />
          </Form.Item>

          <Form.Item
            label="City"
            name="city"
            rules={[{ required: true, message: 'City is required' }]}
          >
            <Input placeholder="City name" />
          </Form.Item>

          <Form.Item
            label="Province"
            name="province"
          >
            <Input placeholder="Province name" />
          </Form.Item>

          <Form.Item
            label="Zip Code"
            name="zipCode"
          >
            <Input placeholder="Postal code" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
