import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Input, Select, message } from 'antd';
import { adminAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Complaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: null,
    search: '',
    page: 1,
    limit: 10
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadComplaints();
  }, [filters]);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getComplaints(filters);
      if (response.data.success) {
        setComplaints(response.data.data.complaints);
      }
    } catch (error) {
      message.error('Failed to load blotters');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (complaintId, newStatus) => {
    try {
      const response = await adminAPI.updateComplaintStatus(complaintId, {
        status: newStatus,
        note: `Status updated to ${newStatus}`
      });
      
      if (response.data.success) {
        message.success('Status updated successfully');
        loadComplaints();
      } else {
        message.error(response.data.message || 'Failed to update status');
      }
    } catch (error) {
      message.error('Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'blue',
      'In Progress': 'orange',
      'Under Review': 'cyan',
      'Resolved': 'green',
      'Closed': 'default',
      'Rejected': 'red'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Urgent': 'red',
      'High': 'orange',
      'Medium': 'gold',
      'Low': 'green'
    };
    return colors[priority] || 'default';
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag>{category}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => <Tag color={getPriorityColor(priority)}>{priority}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/blotters/${record._id}`)}
          >
            View Details
          </Button>
          <Select
            value={record.status}
            style={{ width: 120 }}
            size="small"
            onChange={(value) => handleStatusUpdate(record._id, value)}
            options={[
              { label: 'Pending', value: 'Pending' },
              { label: 'Under Review', value: 'Under Review' },
              { label: 'In Progress', value: 'In Progress' },
              { label: 'Resolved', value: 'Resolved' },
              { label: 'Closed', value: 'Closed' },
              { label: 'Rejected', value: 'Rejected' },
            ]}
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
            placeholder="Search blotters..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by status"
            value={filters.status}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            style={{ width: 150 }}
            allowClear
          >
            <Select.Option value="Pending">Pending</Select.Option>
            <Select.Option value="Under Review">Under Review</Select.Option>
            <Select.Option value="In Progress">In Progress</Select.Option>
            <Select.Option value="Resolved">Resolved</Select.Option>
            <Select.Option value="Closed">Closed</Select.Option>
            <Select.Option value="Rejected">Rejected</Select.Option>
          </Select>
          <Button onClick={loadComplaints} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={complaints}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.limit,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        scroll={{ x: 800 }}
      />
    </div>
  );
};

export default Complaints;
