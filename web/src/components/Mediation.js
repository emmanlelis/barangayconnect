import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Input,
  Table,
  Modal,
  Form,
  DatePicker,
  Space,
  Tag,
  message,
  Select,
  Divider,
  Avatar,
  Row,
  Col,
  Statistic,
  Timeline,
  Empty
} from 'antd';
import {
  UserOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { adminAPI } from '../services/api';
import moment from 'moment';

const { Title, Text } = Typography;

const Mediation = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [defendants, setDefendants] = useState([]);
  const [searchingDefendants, setSearchingDefendants] = useState(false);
  const [defendantSearchText, setDefendantSearchText] = useState('');
  const [defendantModalVisible, setDefendantModalVisible] = useState(false);
  const [mediationModalVisible, setMediationModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [mediationForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getMediationComplaints();
      if (response.data.success) {
        setComplaints(response.data.data || []);
      }
    } catch (error) {
      message.error('Failed to load complaints');
      console.error('Load complaints error:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchDefendants = async (query) => {
    if (!query || query.length < 2) {
      setDefendants([]);
      return;
    }

    try {
      setSearchingDefendants(true);
      const response = await adminAPI.searchUsers({ search: query, limit: 10 });
      if (response.data.success) {
        setDefendants(response.data.data.users || []);
      }
    } catch (error) {
      message.error('Failed to search defendants');
      console.error('Search error:', error);
    } finally {
      setSearchingDefendants(false);
    }
  };

  const handleSelectDefendant = async (defendant) => {
    if (!selectedComplaint) {
      message.error('No complaint selected');
      return;
    }

    try {
      setSubmitting(true);
      const response = await adminAPI.attachDefendant(selectedComplaint._id, {
        defendantId: defendant._id
      });

      if (response.data.success) {
        message.success('Defendant attached successfully');
        setSelectedComplaint({ ...selectedComplaint, defendant: defendant._id, defendantDetails: defendant });
        setDefendantModalVisible(false);
        setDefendantSearchText('');
        setDefendants([]);
        loadComplaints();
      }
    } catch (error) {
      message.error('Failed to attach defendant');
      console.error('Attach defendant error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleMediation = async (values) => {
    if (!selectedComplaint) {
      message.error('No complaint selected');
      return;
    }

    try {
      setSubmitting(true);
      const response = await adminAPI.scheduleMediation(selectedComplaint._id, {
        mediationDate: values.mediationDate.toISOString(),
        notes: values.notes
      });

      if (response.data.success) {
        message.success('Mediation scheduled successfully');
        mediationForm.resetFields();
        setMediationModalVisible(false);
        loadComplaints();
      }
    } catch (error) {
      message.error('Failed to schedule mediation');
      console.error('Schedule mediation error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      scheduled: 'blue',
      'in-progress': 'processing',
      resolved: 'success',
      rejected: 'error'
    };
    return colors[status] || 'default';
  };

  const filterComplaints = () => {
    return complaints.filter(complaint => {
      const searchLower = searchText.toLowerCase();
      const plaintiff = complaint.user || {};
      const matchTitle = complaint.title?.toLowerCase().includes(searchLower);
      const matchPlaintiff = `${plaintiff.firstName || ''} ${plaintiff.lastName || ''}`.toLowerCase().includes(searchLower);

      return matchTitle || matchPlaintiff;
    });
  };

  const columns = [
    {
      title: 'Complaint ID',
      dataIndex: '_id',
      key: '_id',
      width: 120,
      render: (id) => <Text code>{id.substring(0, 8)}</Text>
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200
    },
    {
      title: 'Plaintiff',
      dataIndex: 'user',
      key: 'plaintiff',
      width: 150,
      render: (user) => user ? `${user.firstName} ${user.lastName}` : 'Anonymous'
    },
    {
      title: 'Defendant',
      dataIndex: 'defendantDetails',
      key: 'defendant',
      width: 150,
      render: (defendant) => defendant ? <Tag color="blue">{defendant.firstName} {defendant.lastName}</Tag> : <Tag>Not Yet Assigned</Tag>
    },
    {
      title: 'Mediation Status',
      dataIndex: 'mediationStatus',
      key: 'mediationStatus',
      width: 120,
      render: (status) => <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
    },
    {
      title: 'Mediation Date',
      dataIndex: 'mediationDate',
      key: 'mediationDate',
      width: 120,
      render: (date) => date ? moment(date).format('MMM DD, YYYY') : '-'
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedComplaint(record);
              setMediationModalVisible(true);
              mediationForm.setFieldsValue({
                notes: '',
                mediationDate: record.mediationDate ? moment(record.mediationDate) : null
              });
            }}
          >
            Details
          </Button>
          {!record.defendant && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSelectedComplaint(record);
                setDefendantModalVisible(true);
              }}
            >
              Add Defendant
            </Button>
          )}
        </Space>
      )
    }
  ];

  const filteredComplaints = filterComplaints();

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Title level={2}>
            <FileTextOutlined /> Mediation Management
          </Title>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Cases"
              value={complaints.length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending"
              value={complaints.filter(c => c.mediationStatus === 'pending').length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Scheduled"
              value={complaints.filter(c => c.mediationStatus === 'scheduled').length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Resolved"
              value={complaints.filter(c => c.mediationStatus === 'resolved').length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Mediation Cases" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Search by complaint title or plaintiff name..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ marginBottom: 16 }}
          />
        </div>

        {filteredComplaints.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredComplaints.map((item, index) => ({ ...item, key: index }))}
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
            rowKey="_id"
          />
        ) : (
          <Empty description="No mediation cases found" style={{ marginTop: '48px' }} />
        )}
      </Card>

      {/* Defendant Search Modal */}
      <Modal
        title="Search and Assign Defendant"
        open={defendantModalVisible}
        onCancel={() => {
          setDefendantModalVisible(false);
          setDefendantSearchText('');
          setDefendants([]);
        }}
        footer={null}
        width={600}
      >
        {selectedComplaint && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Text strong>Complaint:</Text> {selectedComplaint.title}
              <br />
              <Text strong>Plaintiff:</Text> {selectedComplaint.user?.firstName} {selectedComplaint.user?.lastName}
            </div>

            <Input.Search
              placeholder="Search defendant by name, email, or phone..."
              prefix={<SearchOutlined />}
              value={defendantSearchText}
              onChange={(e) => {
                setDefendantSearchText(e.target.value);
                searchDefendants(e.target.value);
              }}
              loading={searchingDefendants}
              allowClear
              style={{ marginBottom: 16 }}
            />

            {defendants.length > 0 ? (
              <div>
                <Text>Found {defendants.length} result(s):</Text>
                <div style={{ marginTop: 12 }}>
                  {defendants.map((defendant) => (
                    <Card
                      key={defendant._id}
                      size="small"
                      style={{ marginBottom: 8, cursor: 'pointer' }}
                      hoverable
                      onClick={() => handleSelectDefendant(defendant)}
                    >
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Avatar icon={<UserOutlined />} style={{ marginRight: 12 }} />
                          <Text strong>{defendant.firstName} {defendant.lastName}</Text>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {defendant.email && <div>Email: {defendant.email}</div>}
                            <div>Phone: {defendant.phoneNumber}</div>
                            <div>Barangay: {defendant.address?.barangay}</div>
                          </div>
                        </Col>
                        <Button type="primary" size="small" onClick={() => handleSelectDefendant(defendant)}>
                          Select
                        </Button>
                      </Row>
                    </Card>
                  ))}
                </div>
              </div>
            ) : defendantSearchText ? (
              <Empty description="No results found" />
            ) : (
              <Empty description="Start typing to search for defendants" />
            )}
          </div>
        )}
      </Modal>

      {/* Mediation Details Modal */}
      <Modal
        title="Mediation Details"
        open={mediationModalVisible}
        onCancel={() => {
          setMediationModalVisible(false);
          mediationForm.resetFields();
        }}
        width={700}
        footer={[
          <Button key="close" onClick={() => {
            setMediationModalVisible(false);
            mediationForm.resetFields();
          }}>
            Close
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={() => mediationForm.submit()}
          >
            Schedule Mediation
          </Button>,
        ]}
      >
        {selectedComplaint && (
          <div>
            <Divider>Complaint Information</Divider>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Text strong>Title:</Text>
                <div>{selectedComplaint.title}</div>
              </Col>
              <Col xs={24} sm={12}>
                <Text strong>Category:</Text>
                <div><Tag>{selectedComplaint.category}</Tag></div>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12}>
                <Text strong>Plaintiff:</Text>
                <div>{selectedComplaint.user?.firstName} {selectedComplaint.user?.lastName}</div>
              </Col>
              <Col xs={24} sm={12}>
                <Text strong>Defendant:</Text>
                <div>
                  {selectedComplaint.defendantDetails ? (
                    <Tag color="blue">{selectedComplaint.defendantDetails.firstName} {selectedComplaint.defendantDetails.lastName}</Tag>
                  ) : (
                    <Tag>Not Assigned</Tag>
                  )}
                </div>
              </Col>
            </Row>

            <Divider>Schedule Mediation</Divider>

            <Form
              form={mediationForm}
              layout="vertical"
              onFinish={handleScheduleMediation}
            >
              <Form.Item
                label="Mediation Date"
                name="mediationDate"
                rules={[{ required: true, message: 'Mediation date is required' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="Mediation Notes"
                name="notes"
              >
                <Input.TextArea rows={4} placeholder="Add any notes about the mediation..." />
              </Form.Item>
            </Form>

            {selectedComplaint.mediationNotes && selectedComplaint.mediationNotes.length > 0 && (
              <>
                <Divider>Mediation History</Divider>
                <Timeline>
                  {selectedComplaint.mediationNotes.map((note, index) => (
                    <Timeline.Item key={index}>
                      <p><Text strong>{moment(note.addedAt).format('MMM DD, YYYY HH:mm')}</Text></p>
                      <p>{note.note}</p>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Mediation;