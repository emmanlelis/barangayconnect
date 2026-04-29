import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Row, Col, Table, Button, Space, Tag, Tabs, Input, DatePicker, Select, Statistic, Empty, Modal, Form, TextArea, Calendar, TimePicker, message, Radio, Alert, Divider, Checkbox } from 'antd';
import { 
  FileTextOutlined, 
  SearchOutlined,
  FilterOutlined,
  DownloadOutlined,
  PrinterOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { adminAPI } from '../services/api';
import moment from 'moment';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const RICH_TEXT_TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'link', 'image'],
  ['clean']
];

const RICH_TEXT_FORMATS = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'align',
  'list',
  'bullet',
  'blockquote',
  'link',
  'image'
];

const BlotterManagement = ({ filterType = 'all' }) => {
  const subpoenaBodyEditorRef = useRef(null);
  const [blotters, setBlotters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredBlotters, setFilteredBlotters] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null);
  
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
  const [defendantSearchLoading, setDefendantSearchLoading] = useState(false);
  const [defendantOptions, setDefendantOptions] = useState([]);
  const [selectedDefendant, setSelectedDefendant] = useState(null);
  const [subpoenaSubject, setSubpoenaSubject] = useState('');
  const [subpoenaBody, setSubpoenaBody] = useState('');
  const [complainantEmail, setComplainantEmail] = useState('');
  const [defendantEmail, setDefendantEmail] = useState('');
  const [sendSubpoenaEmail, setSendSubpoenaEmail] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [documentTemplates, setDocumentTemplates] = useState({});
  const [selectedLetterTemplate, setSelectedLetterTemplate] = useState('subpoena');
  const [form] = Form.useForm();

  useEffect(() => {
    loadBlotters();
  }, [filterType, priorityFilter]);

  useEffect(() => {
    loadDocumentTemplates();
  }, []);

  useEffect(() => {
    filterBlotters();
  }, [searchText, selectedDateRange, priorityFilter, blotters]);

  const loadBlotters = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBlotters({ filterType, priority: priorityFilter });
      if (response.data.success) {
        setBlotters(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load blotters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentTemplates = async () => {
    try {
      const response = await adminAPI.getDocumentTemplates();
      if (response.data.success) {
        const templates = response.data.data?.templates || [];
        const templateMap = templates.reduce((acc, item) => {
          acc[item.key] = item;
          return acc;
        }, {});
        setDocumentTemplates(templateMap);
      }
    } catch (error) {
      console.error('Failed to load document templates:', error);
    }
  };

  const renderTemplate = (template = '', values = {}) => {
    return String(template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      const value = values[key];
      return value === undefined || value === null || value === '' ? '' : String(value);
    });
  };

  const formatAddress = (address) => {
    if (!address) return '';

    return [
      address.street,
      address.purok,
      address.barangay,
      address.city,
      address.province,
      address.zipCode
    ]
      .map((value) => (value || '').toString().trim())
      .filter(Boolean)
      .join(', ');
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

    // Client-side priority filter (for when API doesn't filter by priority)
    if (priorityFilter) {
      filtered = filtered.filter(blotter => blotter.priority === priorityFilter);
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
    const resourceType = attachment?.resourceType || attachment?.type || '';
    const url = getAttachmentUrl(attachment);
    if (!url) return;

    // Open documents directly in new tab instead of preview modal
    if (resourceType === 'document' || /\.pdf$|\.html?$|\.docx?$|\.xlsx?$|\.txt$/i.test(url)) {
      window.open(url, '_blank');
      return;
    }

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
    setDefendantOptions(record?.defendantUser ? [record.defendantUser] : []);
    setSelectedDefendant(record?.defendantUser || null);
    setSubpoenaSubject(record?.subpoena?.subject || '');
    setSubpoenaBody(record?.subpoena?.body || '');
    setComplainantEmail(record?.subpoena?.complainantEmail || '');
    setDefendantEmail(record?.subpoena?.defendantEmail || record?.defendantUser?.email || '');
    setSendSubpoenaEmail(false);
    setSelectedLetterTemplate('subpoena');
    setUpdateModalVisible(true);
  };

  const isNewAppSubmission = filterType === 'new' || selectedBlotter?.status === 'new';
  const isThirdMediationCase = selectedBlotter?.status === 'ongoing-3rd';

  const getNextMediationStatus = () => {
    if (selectedBlotter?.status === 'ongoing-2nd') {
      return 'ongoing-3rd';
    }
    if (selectedBlotter?.status === 'ongoing-3rd') {
      return null;
    }
    return 'ongoing-2nd';
  };

  const getNextMediationLabel = () => {
    if (selectedBlotter?.status === 'ongoing-2nd') {
      return 'Unresolved - Schedule 3rd Mediation';
    }
    if (selectedBlotter?.status === 'ongoing-3rd') {
      return '';
    }
    return 'Unresolved - Schedule 2nd Mediation';
  };

  const getNextMediationScheduleLabel = () => {
    if (selectedBlotter?.status === 'ongoing-2nd') {
      return 'Schedule 3rd Mediation Date';
    }
    if (selectedBlotter?.status === 'ongoing-3rd') {
      return '';
    }
    return 'Schedule 2nd Mediation Date';
  };

  const getScheduleDateLabel = () => {
    if (resolutionStatus === 'ongoing-no-mediation') {
      return 'Schedule Visit Date';
    }
    if (resolutionStatus === 'ongoing') {
      return 'Schedule 1st Mediation Date';
    }
    return 'Schedule Date';
  };

  const getScheduleTimeLabel = () => {
    if (resolutionStatus === 'ongoing-no-mediation') {
      return 'Visit Time';
    }
    if (resolutionStatus === 'ongoing') {
      return '1st Mediation Time';
    }
    return 'Schedule Time';
  };

  const getUserDisplayName = (user) => {
    if (!user) return '';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  };

  const handleDefendantSearch = async (query) => {
    const trimmedQuery = (query || '').trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    try {
      setDefendantSearchLoading(true);
      const response = await adminAPI.searchUsers({
        search: trimmedQuery,
        limit: 10,
        filterType: 'active'
      });

      if (response.data.success) {
        const users = response.data.data?.users || [];
        setDefendantOptions(users);
      }
    } catch (error) {
      console.error('Failed to search defendants:', error);
      message.error('Failed to search defendants');
    } finally {
      setDefendantSearchLoading(false);
    }
  };

  const handleSelectDefendant = (defendantId) => {
    const match = defendantOptions.find((user) => user._id === defendantId);
    if (match) {
      setSelectedDefendant(match);
      if (match.email) {
        setDefendantEmail(match.email);
      }
    }
  };

  const handleSelectDefendantOption = (_, option) => {
    const selectedUser = option?.userData;
    if (!selectedUser) {
      return;
    }

    setSelectedDefendant(selectedUser);
    if (selectedUser.email) {
      setDefendantEmail(selectedUser.email);
    }
  };

  const generateSubpoenaDraft = () => {
    if (!selectedBlotter) {
      return;
    }

    if (!isThirdMediationCase && selectedBlotter?.status !== 'lupon' && (!mediationDate || !mediationTime)) {
      message.warning('Please set the mediation schedule date and time first');
      return;
    }

    const scheduleDateText = mediationDate ? mediationDate.format('MMMM DD, YYYY') : '';
    const scheduleTimeText = mediationTime ? mediationTime.format('hh:mm A') : '';
    const defendantName = getUserDisplayName(selectedDefendant) || selectedBlotter.respondent || 'Defendant';
    const defendantAddress = formatAddress(selectedDefendant?.address || selectedBlotter?.defendantUser?.address);
    const complainantAddress = formatAddress(
      selectedBlotter?.complainantUser?.address ||
      selectedBlotter?.sourceComplaint?.user?.address
    );
    
    // Use selected template or default to subpoena
    const selectedTemplate = documentTemplates[selectedLetterTemplate] || documentTemplates.subpoena || {};
    const logoHtml = selectedTemplate.headerImageUrl
      ? `<img src="${selectedTemplate.headerImageUrl}" alt="${selectedTemplate.headerImageAlt || 'Municipality Logo'}" style="max-height: 90px; max-width: 260px; object-fit: contain; display: inline-block;" />`
      : '';

    // Get subject and body templates, with defaults based on template type
    let subjectTemplate = selectedTemplate.subjectTemplate;
    let bodyTemplate = selectedTemplate.bodyTemplate;

    if (!subjectTemplate) {
      if (selectedLetterTemplate === 'certificate_to_file_action') {
        subjectTemplate = 'Certificate to File Action - {{caseNumber}}';
      } else {
        subjectTemplate = 'Subpoena Notice - {{caseNumber}}';
      }
    }

    if (!bodyTemplate) {
      if (selectedLetterTemplate === 'certificate_to_file_action') {
        bodyTemplate = (
          '<div style="text-align:center; margin-bottom: 16px;">{{logoHtml}}</div>' +
          '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #111827;">' +
          '<p style="margin-top: 0;"><strong>CERTIFICATE TO FILE ACTION</strong></p>' +
          '<p>For blotter case {{caseNumber}}, this certifies that barangay-level mediation interventions were completed and further filing action is endorsed.</p>' +
          '<p>Complainant: {{complainantName}}<br />Respondent: {{defendantName}}<br />Date prepared: {{todayDate}}</p>' +
          '<p>Prepared by Barangay Admin</p>' +
          '</div>'
        );
      } else {
        bodyTemplate = (
          '<div style="text-align:center; margin-bottom: 16px;">{{logoHtml}}</div>' +
          '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #111827;">' +
          '<p style="margin-top: 0;">This is to inform {{defendantName}} regarding blotter case {{caseNumber}}.</p>' +
          '<p>Complainant: {{complainantName}}<br />Complainant Address: {{complainantAddress}}<br />Respondent: {{defendantName}}<br />Defendant Address: {{defendantAddress}}</p>' +
          '<p>You are required to appear for the 1st mediation on {{scheduleDate}} at {{scheduleTime}}.</p>' +
          '<p>Date prepared: {{todayDate}}</p>' +
          '<p>Please bring any supporting documents and arrive at least 15 minutes before the schedule.</p>' +
          '</div>'
        );
      }
    }

    const templateValues = {
      caseNumber: selectedBlotter.caseNumber,
      complainantName: selectedBlotter.complainant,
      defendantName,
      defendantAddress,
      complainantAddress,
      scheduleDate: scheduleDateText,
      scheduleTime: scheduleTimeText,
      today: moment().format('MMMM DD, YYYY'),
      todayDate: moment().format('MMMM DD, YYYY'),
      logoHtml
    };

    setSubpoenaSubject(renderTemplate(subjectTemplate, templateValues));
    setSubpoenaBody(renderTemplate(bodyTemplate, templateValues));
  };

  const applyCertificateTemplate = () => {
    if (!selectedBlotter) {
      return;
    }

    const defendantName = getUserDisplayName(selectedDefendant) || selectedBlotter.respondent || 'Defendant';
    const defendantAddress = formatAddress(selectedDefendant?.address || selectedBlotter?.defendantUser?.address);
    const complainantAddress = formatAddress(
      selectedBlotter?.complainantUser?.address ||
      selectedBlotter?.sourceComplaint?.user?.address
    );
    const template = documentTemplates.certificate_to_file_action || {};
    const bodyTemplate = template.bodyTemplate || (
      'For blotter case {{caseNumber}}, this certifies that barangay-level mediation interventions were completed and further filing action is endorsed.\n\n' +
      'Complainant: {{complainantName}}\n' +
      'Respondent: {{defendantName}}\n' +
      'Date prepared: {{today}}\n\n' +
      'Remarks: {{remarks}}'
    );

    const templateValues = {
      caseNumber: selectedBlotter.caseNumber,
      complainantName: selectedBlotter.complainant,
      defendantName,
      defendantAddress,
      complainantAddress,
      today: moment().format('MMMM DD, YYYY'),
      todayDate: moment().format('MMMM DD, YYYY'),
      remarks: 'Prepared by Barangay Admin for certificate to file action.'
    };

    setDocumentation(renderTemplate(bodyTemplate, templateValues));
    message.success('Certificate template applied to documentation');
  };

  const handleUpdateSubmit = async () => {
    if (!resolutionStatus) {
      message.warning('Please select an action');
      return;
    }

    if (!documentation.trim()) {
      message.warning('Documentation is required');
      return;
    }

    if (isNewAppSubmission) {
      if (resolutionStatus === 'ongoing' && !selectedDefendant?._id) {
        message.warning('Please attach a defendant account for mediation-needed cases');
        return;
      }

      if (!mediationDate || !mediationTime) {
        message.warning('Please schedule date and time before updating this blotter');
        return;
      }

      if (resolutionStatus === 'ongoing' && (!subpoenaSubject.trim() || !subpoenaBody.trim())) {
        message.warning('Please generate or provide subpoena details before updating');
        return;
      }
    } else {
      const nextMediationStatus = getNextMediationStatus();
      const isThirdMediation = nextMediationStatus === 'ongoing-3rd';

      if (nextMediationStatus && (resolutionStatus === nextMediationStatus) && (!mediationDate || !mediationTime)) {
        message.warning(`Please schedule mediation date and time for ${isThirdMediation ? '3rd' : '2nd'} mediation`);
        return;
      }
    }

    setUpdateLoading(true);
    try {
      const updateData = {
        status: resolutionStatus,
        documentation,
        mediationDate: mediationDate ? mediationDate.toISOString() : null,
        mediationTime: mediationTime ? mediationTime.format('HH:mm') : null
      };

      const hasSubpoenaData =
        subpoenaSubject.trim() ||
        subpoenaBody.trim() ||
        complainantEmail.trim() ||
        defendantEmail.trim() ||
        sendSubpoenaEmail;

      if (isNewAppSubmission && resolutionStatus === 'ongoing') {
        updateData.defendantId = selectedDefendant?._id;
        updateData.subpoenaEnabled = true;
        updateData.subpoenaSubject = subpoenaSubject.trim();
        updateData.subpoenaBody = subpoenaBody.trim();
        updateData.complainantEmail = complainantEmail.trim();
        updateData.defendantEmail = defendantEmail.trim();
        updateData.sendSubpoenaEmail = sendSubpoenaEmail;
        updateData.documentTemplate = selectedLetterTemplate;
      } else if (hasSubpoenaData) {
        updateData.subpoenaEnabled = true;
        updateData.subpoenaSubject = subpoenaSubject.trim();
        updateData.subpoenaBody = subpoenaBody.trim();
        updateData.complainantEmail = complainantEmail.trim();
        updateData.defendantEmail = defendantEmail.trim();
        updateData.sendSubpoenaEmail = sendSubpoenaEmail;
        updateData.documentTemplate = selectedLetterTemplate;
      }

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
    setDefendantOptions([]);
    setSelectedDefendant(null);
    setSubpoenaSubject('');
    setSubpoenaBody('');
    setComplainantEmail('');
    setDefendantEmail('');
    setSendSubpoenaEmail(false);
    setSelectedLetterTemplate('subpoena');
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
      render: (text, record) => record.isAnonymous ? 'Anonymous' : text,
    },
    {
      title: 'Respondent',
      dataIndex: 'respondent',
      key: 'respondent',
      width: 150,
      render: (text, record) => record.isAnonymous ? 'Unspecified' : text,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status, record) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Tag color={getStatusColor(status)}>
            {getStatusLabel(status)}
          </Tag>
          {record.isAnonymous && <Tag color="orange">Anonymous</Tag>}
        </div>
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
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => {
        const colors = {
          'Urgent': 'red',
          'High': 'orange',
          'Medium': 'blue',
          'Low': 'default'
        };
        return <Tag color={colors[priority] || 'default'}>{priority || 'Medium'}</Tag>;
      },
      filters: [
        { text: 'Urgent', value: 'Urgent' },
        { text: 'High', value: 'High' },
        { text: 'Medium', value: 'Medium' },
        { text: 'Low', value: 'Low' },
      ],
      onFilter: (value, record) => record.priority === value,
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
      anonymous: 'Anonymous Blotters',
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

  const getStats = () => {
    const source = blotters;
    const now = moment();

    const isPendingActionStatus = (status) => [
      'new',
      'ongoing',
      'ongoing-no-mediation',
      'ongoing-2nd',
      'ongoing-3rd',
      'lupon'
    ].includes(status);

    const total = source.length;
    const thisMonth = source.filter((item) => {
      const createdAt = item.dateCreated || item.createdAt;
      return createdAt ? moment(createdAt).isSame(now, 'month') : false;
    }).length;
    const pendingActions = source.filter((item) => isPendingActionStatus(item.status)).length;
    const resolved = source.filter((item) => item.status === 'resolved').length;

    return {
      total,
      thisMonth,
      pendingActions,
      resolved
    };
  };

  const stats = getStats();
  const hideCountersForFilterTypes = [
    'new',
    'anonymous',
    'ongoing-no-mediation',
    'ongoing-new',
    'ongoing-2nd',
    'ongoing-3rd',
    'no-show',
    'resolved',
    'certificate-action',
    'lupon'
  ];
  const shouldShowCounters = !hideCountersForFilterTypes.includes(filterType);

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

      {shouldShowCounters && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Blotters"
                value={stats.total}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="This Month"
                value={stats.thisMonth}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Pending Actions"
                value={stats.pendingActions}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Resolved"
                value={stats.resolved}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#389e0d' }}
              />
            </Card>
          </Col>
        </Row>
      )}

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
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search case number, complainant..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => setSelectedDateRange(dates)}
              placeholder={['Start Date', 'End Date']}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Filter by Priority"
              style={{ width: '100%' }}
              allowClear
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value)}
            >
              <Select.Option value="High">High</Select.Option>
              <Select.Option value="Medium">Medium</Select.Option>
              <Select.Option value="Low">Low</Select.Option>
              <Select.Option value="Urgent">Urgent</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button 
              icon={<FilterOutlined />}
              onClick={() => {
                setSearchText('');
                setSelectedDateRange(null);
                setPriorityFilter(null);
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
            description={searchText || selectedDateRange || priorityFilter ? "No blotters found" : "No blotter records yet"}
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
              <Form.Item label={<Text strong>{isNewAppSubmission ? 'Select Action' : 'Is the issue resolved?'}</Text>} required>
                <Radio.Group 
                  value={resolutionStatus} 
                  onChange={(e) => {
                    setResolutionStatus(e.target.value);
                    setMediationDate(null);
                    setMediationTime(null);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  {isNewAppSubmission ? (
                    <>
                      <Radio value="ongoing-no-mediation">
                        <Text>Schedule a visit</Text>
                      </Radio>
                      <Radio value="ongoing">
                        <Text>Schedule 1st Mediation</Text>
                      </Radio>
                    </>
                  ) : (
                    <>
                      <Radio value="resolved">
                        <Text>Resolved</Text>
                      </Radio>
                      <Radio value="certificate-action">
                        <Text>Certificate to File Action</Text>
                      </Radio>
                      {getNextMediationStatus() && selectedBlotter?.status !== 'ongoing-3rd' && (
                        <Radio value={getNextMediationStatus()}>
                          <Text>{getNextMediationLabel()}</Text>
                        </Radio>
                      )}
                      <Radio value="no-show">
                        <Text>No Show</Text>
                      </Radio>
                      {selectedBlotter?.status !== 'lupon' && (
                        <Radio value="lupon">
                          <Text>Referral to Lupon ng Tagapamayapa</Text>
                        </Radio>
                      )}
                    </>
                  )}
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

              {(isNewAppSubmission ? resolutionStatus : (!isThirdMediationCase && resolutionStatus === getNextMediationStatus())) && (
                <>
                  <Form.Item label={<Text strong>{isNewAppSubmission ? getScheduleDateLabel() : getNextMediationScheduleLabel()}</Text>} required>
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

                  <Form.Item label={<Text strong>{isNewAppSubmission ? getScheduleTimeLabel() : 'Mediation Time'}</Text>} required>
                    <TimePicker
                      format="HH:mm"
                      minuteStep={15}
                      onChange={(time) => setMediationTime(time)}
                      disabledHours={() => [0,1,2,3,4,5,6,7,18,19,20,21,22,23]}
                    />
                  </Form.Item>

                  {isNewAppSubmission && resolutionStatus === 'ongoing' && (
                    <>
                      <Divider orientation="left">Attach Defendant Account</Divider>

                      <Form.Item label={<Text strong>Search Defendant</Text>} required>
                        <Select
                          showSearch
                          allowClear
                          value={selectedDefendant?._id}
                          placeholder="Search by name, email, or phone number"
                          filterOption={false}
                          onSearch={handleDefendantSearch}
                          onChange={(value) => {
                            if (!value) {
                              setSelectedDefendant(null);
                              setDefendantEmail('');
                              return;
                            }
                            handleSelectDefendant(value);
                          }}
                          onSelect={handleSelectDefendantOption}
                          notFoundContent={defendantSearchLoading ? 'Searching...' : 'Type at least 2 characters'}
                          loading={defendantSearchLoading}
                          options={defendantOptions.map((user) => ({
                            value: user._id,
                            label: `${getUserDisplayName(user)}${user.email ? ` (${user.email})` : ''}`,
                            userData: user
                          }))}
                        />
                      </Form.Item>

                      {selectedDefendant && (
                        <Card
                          size="small"
                          style={{ marginBottom: 12, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}
                          title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CheckOutlined style={{ color: '#52c41a' }} />
                              <Text strong>Defendant Selected</Text>
                              <Tag color="green" style={{ marginLeft: 8 }}>Attached</Tag>
                            </div>
                          }
                        >
                          <Text>{getUserDisplayName(selectedDefendant)}</Text>
                          <br />
                          <Text type="secondary">{selectedDefendant.email || 'No email on account'}</Text>
                          <br />
                          <Button
                            size="small"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              setSelectedDefendant(null);
                              setDefendantEmail('');
                            }}
                          >
                            Clear Selection
                          </Button>
                        </Card>
                      )}

                    </>
                  )}
                </>
              )}

              <Divider orientation="left">{isThirdMediationCase ? 'Letter Generator' : 'Subpoena'}</Divider>

              {(isThirdMediationCase || selectedBlotter?.status === 'lupon' || resolutionStatus === getNextMediationStatus()) && (
                <Form.Item label={<Text strong>Document Template</Text>}>
                  <Select
                    value={selectedLetterTemplate}
                    onChange={setSelectedLetterTemplate}
                    placeholder="Select document template"
                    options={Object.entries(documentTemplates).map(([key, template]) => ({
                      label: template.name || key.replace(/_/g, ' ').toUpperCase(),
                      value: key
                    }))}
                  />
                </Form.Item>
              )}

              <Form.Item>
                <Button onClick={generateSubpoenaDraft}>{isThirdMediationCase ? 'Generate Letter Draft' : 'Generate Subpoena Draft'}</Button>
              </Form.Item>

              <Form.Item label={<Text strong>{isThirdMediationCase ? 'Letter Subject' : 'Subpoena Subject'}</Text>} required={!isThirdMediationCase}>
                <Input
                  placeholder={isThirdMediationCase ? 'Enter letter subject (optional)' : 'Enter subpoena subject'}
                  value={subpoenaSubject}
                  onChange={(e) => setSubpoenaSubject(e.target.value)}
                />
              </Form.Item>

              <Form.Item label={<Text strong>{isThirdMediationCase ? 'Letter Body' : 'Subpoena Body'}</Text>} required={!isThirdMediationCase}>
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
                  <ReactQuill
                    ref={subpoenaBodyEditorRef}
                    theme="snow"
                    value={subpoenaBody || ''}
                    onChange={(content) => setSubpoenaBody(content)}
                    modules={{
                      toolbar: RICH_TEXT_TOOLBAR
                    }}
                    formats={RICH_TEXT_FORMATS}
                    placeholder={isThirdMediationCase ? 'Enter letter details (optional)' : 'Enter subpoena details'}
                    style={{ minHeight: 280, background: '#fff' }}
                  />
                </div>
              </Form.Item>

              {isThirdMediationCase && (
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Optional: you can update this case without generating a letter.
                </Text>
              )}

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label={<Text strong>Complainant Email (optional)</Text>}>
                    <Input
                      value={complainantEmail}
                      onChange={(e) => setComplainantEmail(e.target.value)}
                      placeholder="complainant@email.com"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={<Text strong>Defendant Email</Text>}>
                    <Input
                      value={defendantEmail}
                      onChange={(e) => setDefendantEmail(e.target.value)}
                      placeholder="defendant@email.com"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Checkbox
                  checked={sendSubpoenaEmail}
                  onChange={(e) => setSendSubpoenaEmail(e.target.checked)}
                >
                  Send subpoena via email after update
                </Checkbox>
              </Form.Item>

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={handleModalCancel}>Cancel</Button>
                  <Button 
                    type="primary" 
                    loading={updateLoading}
                    onClick={handleUpdateSubmit}
                  >
                    Update
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

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card size="small" title="App Questionnaire">
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Text strong>Filing Against Someone?</Text>
                      <br />
                      <Text>{viewBlotter.isFilingComplaintAgainstSomeone ? 'Yes' : 'No'}</Text>
                    </Col>
                    {viewBlotter.isFilingComplaintAgainstSomeone && (
                      <>
                        <Col span={12}>
                          <Text strong>Respondent / Defendant</Text>
                          <br />
                          <Text>{viewBlotter.respondentName || 'N/A'}</Text>
                        </Col>
                        <Col span={12}>
                          <Text strong>Relationship to Respondent</Text>
                          <br />
                          <Text>{viewBlotter.respondentRelationship || 'N/A'}</Text>
                        </Col>
                        <Col span={24}>
                          <Text strong>Respondent Address</Text>
                          <br />
                          <Text>{viewBlotter.respondentAddress || 'Not provided'}</Text>
                        </Col>
                      </>
                    )}
                  </Row>
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
                <Card size="small" title="Sent Documents">
                  {(() => {
                    const generatedDocuments = Array.isArray(viewBlotter.generatedDocuments)
                      ? viewBlotter.generatedDocuments
                      : [];

                    if (generatedDocuments.length === 0) {
                      return <Text type="secondary">No sent documents recorded for this blotter.</Text>;
                    }

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                        {generatedDocuments.map((documentItem, index) => {
                          const documentUrl = getAttachmentUrl(documentItem);
                          const documentLabel = documentItem?.filename || documentItem?.subject || `Document ${index + 1}`;

                          return (
                            <div
                              key={documentItem?._id || documentUrl || index}
                              onClick={() => documentUrl && handleAttachmentClick({ ...documentItem, url: documentUrl })}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  if (documentUrl) {
                                    handleAttachmentClick({ ...documentItem, url: documentUrl });
                                  }
                                }
                              }}
                              style={{
                                border: '1px solid #f0f0f0',
                                borderRadius: 8,
                                padding: 12,
                                cursor: documentUrl ? 'pointer' : 'default',
                                background: '#fff'
                              }}
                            >
                              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                                {documentLabel}
                              </Text>
                              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                                {documentItem?.documentType || 'document'}
                              </Text>
                              {documentItem?.uploadedAt && (
                                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                                  {moment(documentItem.uploadedAt).format('MMMM DD, YYYY hh:mm A')}
                                </Text>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </Card>
              </Col>
            </Row>

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
