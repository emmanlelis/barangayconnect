import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Tag, Button, Modal, Form, Input, Space, message, Descriptions, Timeline } from 'antd';
import { adminAPI, complaintAPI } from '../services/api';

const { Title, Paragraph, Text } = Typography;

const ComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [noteText, setNoteText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    loadComplaintDetail();
  }, [id]);

  const loadComplaintDetail = async () => {
    try {
      const response = await complaintAPI.getComplaint(id);
      if (response.data.success) {
        setComplaint(response.data.data.complaint);
      }
    } catch (error) {
      message.error('Failed to load blotter details');
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus) {
      message.error('Please select a status');
      return;
    }

    setLoading(true);
    try {
      const response = await adminAPI.updateComplaintStatus(id, {
        status: selectedStatus,
        note: `Status updated to ${selectedStatus}`
      });
      
      if (response.data.success) {
        message.success('Status updated successfully');
        setStatusModalVisible(false);
        setSelectedStatus('');
        loadComplaintDetail();
      } else {
        message.error(response.data.message || 'Failed to update status');
      }
    } catch (error) {
      message.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      message.error('Please enter a note');
      return;
    }

    setLoading(true);
    try {
      const response = await adminAPI.addAdminNote(id, {
        note: noteText
      });
      
      if (response.data.success) {
        message.success('Note added successfully');
        setNoteModalVisible(false);
        setNoteText('');
        loadComplaintDetail();
      } else {
        message.error(response.data.message || 'Failed to add note');
      }
    } catch (error) {
      message.error('Failed to add note');
    } finally {
      setLoading(false);
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

  if (!complaint) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate('/blotters')}>
          ← Back to Blotters
        </Button>
      </div>

      <Card>
        <Title level={2}>{complaint.title}</Title>
        
        <Space size="large" wrap>
          <Tag color={getStatusColor(complaint.status)}>{complaint.status}</Tag>
          <Tag color={getPriorityColor(complaint.priority)}>{complaint.priority}</Tag>
          <Tag>{complaint.category}</Tag>
        </Space>

        <Descriptions title="Blotter Details" bordered column={2}>
          <Descriptions.Item label="Description">
            {complaint.description}
          </Descriptions.Item>
          <Descriptions.Item label="Location">
            {complaint.location}
          </Descriptions.Item>
          <Descriptions.Item label="Submitted By">
            {complaint.isAnonymous ? 'Anonymous' : `${complaint.user?.firstName} ${complaint.user?.lastName}`}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {complaint.isAnonymous ? complaint.anonymousContact : complaint.user?.email}
          </Descriptions.Item>
          <Descriptions.Item label="Phone">
            {complaint.isAnonymous ? 'Not provided' : complaint.user?.phoneNumber}
          </Descriptions.Item>
          <Descriptions.Item label="Submitted">
            {new Date(complaint.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Progress">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 200, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
                <div 
                  style={{ 
                    width: `${complaint.progress}%`, 
                    height: 8, 
                    backgroundColor: getStatusColor(complaint.status),
                    borderRadius: 4 
                  }} 
                />
              </div>
              <Text>{complaint.progress}%</Text>
            </div>
          </Descriptions.Item>
        </Descriptions>

        {complaint.images && complaint.images.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Title level={4}>Attached Images</Title>
            <Space wrap>
              {complaint.images.map((image, index) => (
                <img
                  key={index}
                  src={image.url}
                  alt={`Blotter image ${index + 1}`}
                  style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                />
              ))}
            </Space>
          </div>
        )}

        {complaint.adminNotes && complaint.adminNotes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Title level={4}>Admin Notes</Title>
            <Timeline>
              {complaint.adminNotes.map((note, index) => (
                <Timeline.Item key={index}>
                  <Text strong>{note.addedBy?.firstName} {note.addedBy?.lastName}</Text>
                  <br />
                  <Text type="secondary">{new Date(note.addedAt).toLocaleString()}</Text>
                  <p>{note.note}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}

        <Space style={{ marginTop: 24 }}>
          <Button 
            type="primary" 
            onClick={() => setStatusModalVisible(true)}
          >
            Update Status
          </Button>
          <Button 
            onClick={() => setNoteModalVisible(true)}
          >
            Add Note
          </Button>
        </Space>
      </Card>

      {/* Status Update Modal */}
      <Modal
        title="Update Status"
        open={statusModalVisible}
        onOk={handleStatusUpdate}
        onCancel={() => setStatusModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="New Status" required>
            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Select status...</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Note Modal */}
      <Modal
        title="Add Admin Note"
        open={noteModalVisible}
        onOk={handleAddNote}
        onCancel={() => setNoteModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Note" required>
            <Input.TextArea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="Enter your note here..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ComplaintDetail;
