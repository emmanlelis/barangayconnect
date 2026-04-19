import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Table, Button, Space, Tag, Tabs, Input, DatePicker, Select, Statistic, Empty, Modal, Form, TextArea, Calendar, TimePicker, message, Radio, Alert } from 'antd';
import { 
  FileTextOutlined, 
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  PrinterOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { adminAPI } from '../services/api';
import moment from 'moment';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const BlotterManagement = ({ filterType = 'all' }) => {
  const [blotters, setBlotters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredBlotters, setFilteredBlotters] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  
  // View modal states
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewBlotter, setViewBlotter] = useState(null);
  const [attachmentPreviewVisible, setAttachmentPreviewVisible] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  
  // Update modal states
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedBlotter, setSelectedBlotter] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState(null);
  const [documentation, setDocumentation] = useState('');
  const [mediationDate, setMediationDate] = useState(null);
  const [mediationTime, setMediationTime] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadBlotters();
  }, [filterType]);

  useEffect(() => {
    filterBlotters();
  }, [searchText, selectedDateRange, blotters]);

  const loadBlotters = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBlotters({ filterType });
      if (response.data.success) {
        setBlotters(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load blotters:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterBlotters = () => {
    let filtered = blotters;

    if (searchText) {
      filtered = filtered.filter(blotter =>
        blotter.caseNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
        blotter.complainant?.toLowerCase().includes(searchText.toLowerCase()) ||
        blotter.respondent?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (selectedDateRange && selectedDateRange.length === 2) {
      filtered = filtered.filter(blotter => {
        const blotterDate = moment(blotter.dateCreated);
        return blotterDate.isBetween(selectedDateRange[0], selectedDateRange[1], null, '[]');
      });
    }

    setFilteredBlotters(filtered);
  };

  const handleViewClick = async (record) => {
    try {
      setViewModalVisible(true);
      setViewBlotter(record);

      const response = await adminAPI.getBlotterById(record._id);
      if (response.data.success && response.data.data) {
        setViewBlotter(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load blotter details:', error);
      message.error('Failed to load blotter details');
    }
  };

  const handleViewModalCancel = () => {
    setViewModalVisible(false);
    setViewBlotter(null);
  };

  const handleAttachmentClick = (attachment) => {
    setAttachmentPreview(attachment);
    setAttachmentPreviewVisible(true);
  };

  const handleAttachmentPreviewCancel = () => {
    setAttachmentPreviewVisible(false);
    setAttachmentPreview(null);
  };

  const getAttachmentUrl = (attachment) => attachment?.url || attachment?.secure_url || attachment?.secureUrl || attachment?.path || '';

  const isVideoAttachment = (attachment) => {
    const resourceType = attachment?.resourceType || attachment?.type || '';
    const format = attachment?.format || '';
    return resourceType === 'video' || /mp4|mov|webm|m4v|avi|mkv/i.test(format);
  };

  const handleUpdateClick = (record) => {
    setSelectedBlotter(record);
    setResolutionStatus(null);
    setDocumentation('');
    setMediationDate(null);
    setMediationTime(null);
    setUpdateModalVisible(true);
  };

  const getNextMediationStatus = () => {
    if (selectedBlotter?.status === 'ongoing-2nd') {
      return 'ongoing-3rd';
    }
    return 'ongoing-2nd';
  };

  const getNextMediationLabel = () => {
    if (selectedBlotter?.status === 'ongoing-2nd') {
      return 'Unresolved - Schedule 3rd Mediation';
    }
    return 'Unresolved - Schedule 2nd Mediation';
  };

  const getNextMediationScheduleLabel = () => {
    if (selectedBlotter?.status === 'ongoing-2nd') {
      return 'Schedule 3rd Mediation Date';
    }
    return 'Schedule 2nd Mediation Date';
  };

  const handleUpdateSubmit = async () => {
    if (!resolutionStatus) {
      message.warning('Please select a resolution status');
      return;
    }

    if (!documentation.trim()) {
      message.warning('Documentation is required');
      return;
    }

    const nextMediationStatus = getNextMediationStatus();
    const isThirdMediation = nextMediationStatus === 'ongoing-3rd';

    if ((resolutionStatus === nextMediationStatus) && (!mediationDate || !mediationTime)) {
      message.warning(`Please schedule mediation date and time for ${isThirdMediation ? '3rd' : '2nd'} mediation`);
      return;
    }

    setUpdateLoading(true);
    try {
      const updateData = {
        status: resolutionStatus,
        documentation,
        mediationDate: mediationDate ? mediationDate.toISOString() : null,
        mediationTime: mediationTime ? mediationTime.format('HH:mm') : null
      };

      await adminAPI.updateBlotterStatus(selectedBlotter._id, updateData);
      message.success('Blotter status updated successfully');
      setUpdateModalVisible(false);
      loadBlotters();
    } catch (error) {
      console.error('Update error:', error);
      message.error('Failed to update blotter status');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleModalCancel = () => {
    setUpdateModalVisible(false);
    setSelectedBlotter(null);
    setResolutionStatus(null);
    setDocumentation('');
    setMediationDate(null);
    setMediationTime(null);
  };

  const handleDeleteBlotter = (record) => {
    Modal.confirm({
      title: 'Delete Blotter',
      content: `Are you sure you want to delete case ${record.caseNumber}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await adminAPI.deleteBlotter(record._id);
          message.success('Blotter deleted successfully');
          loadBlotters();
        } catch (error) {
          console.error('Delete blotter error:', error);
          const errorMessage = error.response?.data?.message || 'Failed to delete blotter';
          message.error(errorMessage);
        }
      }
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'blue',
      ongoing: 'processing',
      'ongoing-2nd': 'orange',
      'ongoing-3rd': 'warning',
      'no-show': 'error',
      resolved: 'success',
      'certificate-action': 'purple'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      new: 'New',
      ongoing: 'Ongoing',
      'ongoing-2nd': 'Ongoing (2nd Mediation)',
      'ongoing-3rd': 'Ongoing (3rd Mediation)',
      'no-show': 'No Show',
      resolved: 'Resolved',
      'certificate-action': 'Certificate to File Action'
    };
    return labels[status] || status;
  };

  let columns = [
    {
      title: 'Case Number',
      dataIndex: 'caseNumber',
      key: 'caseNumber',
      width: 120,
      sorter: (a, b) => a.caseNumber.localeCompare(b.caseNumber),
    },
    {
      title: 'Complainant',
      dataIndex: 'complainant',
      key: 'complainant',
      width: 150,
    },
    {
      title: 'Respondent',
      dataIndex: 'respondent',
      key: 'respondent',
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusLabel(status)}
        </Tag>
      ),
      filters: [
        { text: 'New', value: 'new' },
        { text: 'Ongoing', value: 'ongoing' },
        { text: 'Ongoing (2nd Mediation)', value: 'ongoing-2nd' },
        { text: 'Ongoing (3rd Mediation)', value: 'ongoing-3rd' },
        { text: 'No Show', value: 'no-show' },
        { text: 'Resolved', value: 'resolved' },
        { text: 'Certificate to File Action', value: 'certificate-action' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Date Created',
      dataIndex: 'dateCreated',
      key: 'dateCreated',
      width: 120,
      render: (_, record) => moment(record.dateCreated || record.createdAt).format('MMM DD, YYYY'),
      sorter: (a, b) => moment(a.dateCreated || a.createdAt).unix() - moment(b.dateCreated || b.createdAt).unix(),
    },
    {
      title: 'Action',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewClick(record)}>View</Button>
          {filterType !== 'recently-deleted' && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleUpdateClick(record)}>Update</Button>
          )}
          {filterType === 'all' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteBlotter(record)}
            >
              Delete
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (filterType === 'recently-deleted') {
    columns.splice(5, 0, {
      title: 'Deleted On',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 140,
      render: (date) => date ? moment(date).format('MMM DD, YYYY HH:mm') : 'N/A',
      sorter: (a, b) => moment(a.deletedAt).unix() - moment(b.deletedAt).unix(),
    });
  }

  const getTitleByFilter = () => {
    const titles = {
      all: 'All Blotters',
      new: 'New Blotters',
      ongoing: 'Ongoing Blotters',
      'ongoing-new': 'New Ongoing Blotters',
      'ongoing-2nd': 'Ongoing for 2nd Mediation Blotters',
      'ongoing-3rd': 'Ongoing for 3rd Mediation Blotters',
      closed: 'Closed Blotters',
      'no-show': 'No Show Blotters',
      resolved: 'Resolved Blotters',
      'certificate-action': 'Certificate to File Action',
      lupon: 'Lupon ng Tagapamayapa',
      'recently-deleted': 'Recently Deleted Blotters'
    };
    return titles[filterType] || 'Blotter Management';
  };

  const getStatsCount = () => {
    if (filterType === 'all') return blotters.length;
    return filteredBlotters.length;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Title level={2}>
            <FileTextOutlined /> {getTitleByFilter()}
          </Title>
        </Col>
      </Row>

      {filterType === 'recently-deleted' && (
        <Alert
          type="warning"
          showIcon
          message="Retention Notice"
          description="Blotters that are 31 days old and up will be permanently deleted."
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Blotters"
              value={getStatsCount()}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="This Month"
              value={Math.round(getStatsCount() * 0.4)}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending Action"
              value={Math.round(getStatsCount() * 0.2)}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Resolved"
              value={Math.round(getStatsCount() * 0.3)}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#389e0d' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Blotter Records"
        extra={
          <Space>
            <Button icon={<DownloadOutlined />}>Export</Button>
            <Button icon={<PrinterOutlined />}>Print</Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search case number, complainant..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => setSelectedDateRange(dates)}
              placeholder={['Start Date', 'End Date']}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Button 
              icon={<FilterOutlined />}
              onClick={() => {
                setSearchText('');
                setSelectedDateRange(null);
              }}
              block
            >
              Clear Filters
            </Button>
          </Col>
        </Row>

        {filteredBlotters.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredBlotters.map((item, index) => ({ ...item, key: index }))}
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
          />
        ) : (
          <Empty 
            description={searchText || selectedDateRange ? "No blotters found" : "No blotter records yet"}
            style={{ marginTop: '48px' }}
          />
        )}
      </Card>

      {/* Update Blotter Modal */}
      <Modal
        title="Update Blotter Status"
        visible={updateModalVisible}
        onCancel={handleModalCancel}
        footer={null}
        width={600}
      >
        {selectedBlotter && (
          <div>
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f0f2f5' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Case Number:</Text>
                  <br />
                  <Text>{selectedBlotter.caseNumber}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Complainant:</Text>
                  <br />
                  <Text>{selectedBlotter.complainant}</Text>
                </Col>
              </Row>
            </Card>

            <Form layout="vertical">
              <Form.Item label={<Text strong>Is the issue resolved?</Text>}>
                <Radio.Group 
                  value={resolutionStatus} 
                  onChange={(e) => {
                    setResolutionStatus(e.target.value);
                    setMediationDate(null);
                    setMediationTime(null);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <Radio value="resolved">
                    <Text>Resolved</Text>
                  </Radio>
                  <Radio value={getNextMediationStatus()}>
                    <Text>{getNextMediationLabel()}</Text>
                  </Radio>
                  <Radio value="no-show">
                    <Text>No Show</Text>
                  </Radio>
                  <Radio value="lupon">
                    <Text>Referral to Lupon ng Tagapamayapa</Text>
                  </Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item 
                label={<Text strong>Documentation</Text>}
                required
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Enter documentation for this resolution"
                  value={documentation}
                  onChange={(e) => setDocumentation(e.target.value)}
                />
              </Form.Item>

              {resolutionStatus === getNextMediationStatus() && (
                <>
                  <Form.Item label={<Text strong>{getNextMediationScheduleLabel()}</Text>}>
                    <Calendar
                      fullscreen={false}
                      onSelect={(date) => setMediationDate(date)}
                    />
                    {mediationDate && (
                      <Text type="secondary">
                        Selected: {mediationDate.format('YYYY-MM-DD')}
                      </Text>
                    )}
                  </Form.Item>

                  <Form.Item label={<Text strong>Mediation Time</Text>}>
                    <TimePicker
                      format="HH:mm"
                      minuteStep={15}
                      onChange={(time) => setMediationTime(time)}
                      disabledHours={() => [0,1,2,3,4,5,6,7,18,19,20,21,22,23]}
                    />
                  </Form.Item>
                </>
              )}

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={handleModalCancel}>Cancel</Button>
                  <Button 
                    type="primary" 
                    loading={updateLoading}
                    onClick={handleUpdateSubmit}
                  >
                    {resolutionStatus === getNextMediationStatus() ? 'Update' : 'Save'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* View Blotter Modal */}
      <Modal
        title="View Blotter Details"
        visible={viewModalVisible}
        onCancel={handleViewModalCancel}
        footer={[
          <Button key="close" onClick={handleViewModalCancel}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {viewBlotter && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Case Number</Text>
                  <br />
                  <Text style={{ fontSize: 16, color: '#1890ff' }}>
                    {viewBlotter.caseNumber}
                  </Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Status</Text>
                  <br />
                  <Tag color={getStatusColor(viewBlotter.status)}>
                    {getStatusLabel(viewBlotter.status)}
                  </Tag>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Complainant</Text>
                  <br />
                  <Text>{viewBlotter.complainant}</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Respondent</Text>
                  <br />
                  <Text>{viewBlotter.respondent}</Text>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card size="small">
                  <Text strong>Description</Text>
                  <br />
                  <Text style={{ whiteSpace: 'pre-wrap', marginTop: 8, display: 'block' }}>
                    {viewBlotter.description}
                  </Text>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Location</Text>
                  <br />
                  <Text>{viewBlotter.location || 'N/A'}</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Case Type</Text>
                  <br />
                  <Text>{viewBlotter.caseType === 'lupon' ? 'Lupon ng Tagapamayapa' : 'Regular'}</Text>
                </Card>
              </Col>
            </Row>

            {viewBlotter.notes && (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={24}>
                  <Card size="small">
                    <Text strong>Notes</Text>
                    <br />
                    <Text style={{ whiteSpace: 'pre-wrap', marginTop: 8, display: 'block' }}>
                      {viewBlotter.notes}
                    </Text>
                  </Card>
                </Col>
              </Row>
            )}

            {viewBlotter.dateOfMeeting && (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={12}>
                  <Card size="small">
                    <Text strong>Scheduled Meeting Date</Text>
                    <br />
                    <Text>{moment(viewBlotter.dateOfMeeting).format('MMMM DD, YYYY HH:mm')}</Text>
                  </Card>
                </Col>
              </Row>
            )}

            {viewBlotter.resolution && (
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={24}>
                  <Card size="small">
                    <Text strong>Resolution</Text>
                    <br />
                    <Text style={{ whiteSpace: 'pre-wrap', marginTop: 8, display: 'block' }}>
                      {viewBlotter.resolution}
                    </Text>
                  </Card>
                </Col>
              </Row>
            )}

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card size="small" title="Attachments">
                  {(() => {
                    const attachments = Array.isArray(viewBlotter.attachments)
                      ? viewBlotter.attachments
                      : (Array.isArray(viewBlotter.evidence) ? viewBlotter.evidence : (Array.isArray(viewBlotter.images) ? viewBlotter.images : []));

                    if (attachments.length === 0) {
                      return <Text type="secondary">No attachments uploaded for this blotter.</Text>;
                    }

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                        {attachments.map((attachment, index) => {
                        const attachmentUrl = getAttachmentUrl(attachment);
                        const videoAttachment = isVideoAttachment(attachment);
                        const attachmentLabel = attachment?.filename || attachment?.originalName || `Attachment ${index + 1}`;

                        return (
                          <div
                            key={attachment?._id || attachmentUrl || index}
                            onClick={() => attachmentUrl && handleAttachmentClick({ ...attachment, url: attachmentUrl })}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                if (attachmentUrl) {
                                  handleAttachmentClick({ ...attachment, url: attachmentUrl });
                                }
                              }
                            }}
                            style={{
                              border: '1px solid #f0f0f0',
                              borderRadius: 8,
                              overflow: 'hidden',
                              cursor: attachmentUrl ? 'pointer' : 'default',
                              background: '#fff'
                            }}
                          >
                            <div style={{ width: '100%', height: 110, backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {attachmentUrl ? (
                                videoAttachment ? (
                                  <video
                                    src={attachmentUrl}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    muted
                                  />
                                ) : (
                                  <img
                                    src={attachmentUrl}
                                    alt={attachmentLabel}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                )
                              ) : (
                                <Text type="secondary">No preview</Text>
                              )}
                            </div>
                            <div style={{ padding: 8 }}>
                              <Text ellipsis={{ tooltip: attachmentLabel }} style={{ fontSize: 12, display: 'block' }}>
                                {attachmentLabel}
                              </Text>
                              <Tag color={videoAttachment ? 'purple' : 'blue'} style={{ marginTop: 6 }}>
                                {videoAttachment ? 'Video' : 'Photo'}
                              </Tag>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    );
                  })()}
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Mediation Count</Text>
                  <br />
                  <Text>{viewBlotter.mediationCount || 0}</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text strong>Date Created</Text>
                  <br />
                  <Text>{moment(viewBlotter.createdAt).format('MMMM DD, YYYY')}</Text>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      <Modal
        visible={attachmentPreviewVisible}
        onCancel={handleAttachmentPreviewCancel}
        footer={null}
        width={900}
        title={attachmentPreview?.filename || attachmentPreview?.originalName || 'Attachment Preview'}
      >
        {attachmentPreview && getAttachmentUrl(attachmentPreview) && (
          isVideoAttachment(attachmentPreview) ? (
            <video
              src={getAttachmentUrl(attachmentPreview)}
              controls
              style={{ width: '100%', maxHeight: '75vh', borderRadius: 8, backgroundColor: '#000' }}
            />
          ) : (
            <img
              src={getAttachmentUrl(attachmentPreview)}
              alt={attachmentPreview?.filename || attachmentPreview?.originalName || 'Attachment Preview'}
              style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain' }}
            />
          )
        )}
      </Modal>
    </div>
  );
};

export default BlotterManagement;
