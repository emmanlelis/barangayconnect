import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, Typography, Upload, Select, DatePicker, Calendar, TimePicker, message, Row, Col, Steps, Modal, Divider, Tag, Empty, Checkbox, Result } from 'antd';
import { FileTextOutlined, UploadOutlined, UserOutlined, PhoneOutlined, EnvironmentOutlined, TeamOutlined, UserAddOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Step } = Steps;
const TEMPLATE_STORAGE_KEY = 'manualBlotterSubpoenaTemplates';
const DRAFT_STORAGE_KEY = 'manualBlotterDraft';

const ManualComplaint = () => {
  const [form] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState([]);
  const [mediationDate, setMediationDate] = useState(null);
  const [mediationTime, setMediationTime] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createAccountModalVisible, setCreateAccountModalVisible] = useState(false);
  const [createAccountLoading, setCreateAccountLoading] = useState(false);
  // Defendant search states
  const [defendantSearchFirstName, setDefendantSearchFirstName] = useState('');
  const [defendantSearchLastName, setDefendantSearchLastName] = useState('');
  const [defendantSearchResults, setDefendantSearchResults] = useState([]);
  const [defendantSearchLoading, setDefendantSearchLoading] = useState(false);
  const [selectedDefendant, setSelectedDefendant] = useState(null);
  const [subpoenaTemplates, setSubpoenaTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('default');
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateLogoDataUrl, setTemplateLogoDataUrl] = useState('');
  const [draftFormValues, setDraftFormValues] = useState({});
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [submittedCaseNumber, setSubmittedCaseNumber] = useState('');
  const isRestoringDraftRef = useRef(false);
  const { user } = useAuth();

  const mediationRequired = Form.useWatch('mediationRequired', form);
  const subpoenaEnabled = Form.useWatch('subpoenaEnabled', form);

  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (savedTemplates) {
        const parsedTemplates = JSON.parse(savedTemplates);
        if (Array.isArray(parsedTemplates)) {
          setSubpoenaTemplates(parsedTemplates);
        }
      }
    } catch (error) {
      console.error('Failed to load saved templates:', error);
    }
  }, []);

  useEffect(() => {
    try {
      isRestoringDraftRef.current = true;

      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!savedDraft) {
        isRestoringDraftRef.current = false;
        return;
      }

      const parsedDraft = JSON.parse(savedDraft);
      if (!parsedDraft || typeof parsedDraft !== 'object') {
        isRestoringDraftRef.current = false;
        return;
      }

      if (parsedDraft.formValues) {
        const hydratedValues = { ...parsedDraft.formValues };

        if (hydratedValues.incidentDate) {
          hydratedValues.incidentDate = dayjs(hydratedValues.incidentDate);
        }

        if (hydratedValues.subpoenaEnabled) {
          hydratedValues.subpoenaEnabled = true;
        }

        if (hydratedValues.sendSubpoenaEmail) {
          hydratedValues.sendSubpoenaEmail = true;
        }

        form.setFieldsValue(hydratedValues);
        setDraftFormValues(hydratedValues);
      }

      if (parsedDraft.currentStep !== undefined) {
        setCurrentStep(parsedDraft.currentStep);
      }

      if (parsedDraft.mediationDate) {
        setMediationDate(dayjs(parsedDraft.mediationDate));
      }

      if (parsedDraft.mediationTime) {
        setMediationTime(dayjs(parsedDraft.mediationTime, 'HH:mm'));
      }

      if (parsedDraft.selectedDefendant) {
        setSelectedDefendant(parsedDraft.selectedDefendant);
      }

      if (parsedDraft.selectedTemplateId) {
        setSelectedTemplateId(parsedDraft.selectedTemplateId);
      }

      if (parsedDraft.templateLogoDataUrl) {
        setTemplateLogoDataUrl(parsedDraft.templateLogoDataUrl);
      }

      // Ensure hydration finishes before autosave can run again.
      setTimeout(() => {
        isRestoringDraftRef.current = false;
      }, 0);
    } catch (error) {
      console.error('Failed to restore manual blotter draft:', error);
      isRestoringDraftRef.current = false;
    }
  }, []);

  const persistTemplates = (templates) => {
    setSubpoenaTemplates(templates);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  };

  const persistDraft = (nextValues = {}, baseValues = null) => {
    if (isRestoringDraftRef.current) {
      return;
    }

    const currentValues = baseValues || form.getFieldsValue(true);
    const mergedValues = { ...draftFormValues, ...currentValues, ...nextValues };

    setDraftFormValues(mergedValues);

    const draftPayload = {
      currentStep: nextValues.currentStep ?? currentStep,
      formValues: {
        ...mergedValues,
        incidentDate: mergedValues.incidentDate ? mergedValues.incidentDate.toISOString?.() || mergedValues.incidentDate : null,
        subpoenaEnabled: !!mergedValues.subpoenaEnabled,
        sendSubpoenaEmail: !!mergedValues.sendSubpoenaEmail
      },
      mediationDate: mediationDate ? mediationDate.toISOString() : null,
      mediationTime: mediationTime ? mediationTime.format('HH:mm') : null,
      selectedDefendant,
      selectedTemplateId,
      templateLogoDataUrl
    };

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
  };

  useEffect(() => {
    if (isRestoringDraftRef.current) {
      return;
    }

    if (Object.keys(draftFormValues).length === 0) {
      return;
    }

    // Rehydrate fields for the currently visible step.
    form.setFieldsValue(draftFormValues);
  }, [currentStep]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const getSavedDraftValues = () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!savedDraft) {
        return {};
      }

      const parsedDraft = JSON.parse(savedDraft);
      return parsedDraft?.formValues || {};
    } catch (error) {
      console.error('Failed to read saved draft values:', error);
      return {};
    }
  };

  const buildDefaultSubpoenaBody = (values = {}) => {
    const complainant = values.citizenName || 'Complainant/Plaintiff';
    const respondent = selectedDefendant
      ? `${selectedDefendant.firstName} ${selectedDefendant.lastName}`
      : values.defendantName || 'Defendant';
    const dateText = mediationDate ? mediationDate.format('MMMM DD, YYYY') : '[Set Date]';
    const timeText = mediationTime ? mediationTime.format('HH:mm') : '[Set Time]';
    const venueText = values.location || '[Set Venue]';

    return [
      'Republic of the Philippines',
      'BarangayConnect - Notice of Mediation/Subpoena',
      '',
      `Case: ${values.title || 'Manual Blotter Case'}`,
      `Complainant/Plaintiff: ${complainant}`,
      `Defendant/Respondent: ${respondent}`,
      '',
      'TO THE PARTIES:',
      'You are hereby required to appear for mediation regarding the above case.',
      '',
      `Date: ${dateText}`,
      `Time: ${timeText}`,
      `Venue: ${venueText}`,
      '',
      'Failure to appear may result in appropriate action based on barangay procedures.',
      '',
      'Issued by:',
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Barangay Administrator',
      `Generated on: ${new Date().toLocaleString()}`
    ].join('\n');
  };

  const getTemplateTokens = (values = {}) => {
    const complainant = values.citizenName || 'Complainant/Plaintiff';
    const defendant = selectedDefendant
      ? `${selectedDefendant.firstName} ${selectedDefendant.lastName}`
      : values.defendantName || 'Defendant';

    return {
      '{{case_title}}': values.title || 'Manual Blotter Case',
      '{{complainant_name}}': complainant,
      '{{defendant_name}}': defendant,
      '{{mediation_date}}': mediationDate ? mediationDate.format('MMMM DD, YYYY') : '[Set Date]',
      '{{mediation_time}}': mediationTime ? mediationTime.format('HH:mm') : '[Set Time]',
      '{{venue}}': values.location || '[Set Venue]',
      '{{admin_name}}': `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Barangay Administrator',
      '{{generated_at}}': new Date().toLocaleString()
    };
  };

  const applyTokens = (templateText, values = {}) => {
    const tokens = getTemplateTokens(values);
    let output = templateText || '';

    Object.entries(tokens).forEach(([token, value]) => {
      output = output.split(token).join(value);
    });

    return output;
  };

  const getSelectedTemplate = () => {
    if (selectedTemplateId === 'default') {
      return {
        id: 'default',
        name: 'Default Template',
        subject: 'Subpoena Notice - {{case_title}}',
        body: buildDefaultSubpoenaBody(form.getFieldsValue(true)),
        logoDataUrl: ''
      };
    }

    return subpoenaTemplates.find((template) => template.id === selectedTemplateId) || null;
  };

  const applySelectedTemplate = () => {
    const values = form.getFieldsValue(true);
    const template = getSelectedTemplate();

    if (!template) {
      message.warning('Please select a template first.');
      return;
    }

    const subject = applyTokens(template.subject || 'Subpoena Notice - {{case_title}}', values);
    const body = selectedTemplateId === 'default'
      ? buildDefaultSubpoenaBody(values)
      : applyTokens(template.body || '', values);

    form.setFieldsValue({
      subpoenaSubject: subject,
      subpoenaBody: body
    });

    persistDraft({
      subpoenaSubject: subject,
      subpoenaBody: body
    });

    message.success(`Template applied: ${template.name}`);
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const handleTemplateLogoUpload = async (file) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setTemplateLogoDataUrl(dataUrl);
      persistDraft({ templateLogoDataUrl: dataUrl });
      message.success('Logo uploaded');
    } catch (error) {
      message.error('Failed to upload logo');
    }

    return false;
  };

  const resetTemplateEditor = () => {
    setEditingTemplateId(null);
    setTemplateLogoDataUrl('');
    templateForm.resetFields();
  };

  const openNewTemplateEditor = () => {
    resetTemplateEditor();
    templateForm.setFieldsValue({
      name: '',
      subject: 'Subpoena Notice - {{case_title}}',
      body: [
        'Republic of the Philippines',
        'BarangayConnect - Notice of Mediation/Subpoena',
        '',
        'Case: {{case_title}}',
        'Complainant/Plaintiff: {{complainant_name}}',
        'Defendant/Respondent: {{defendant_name}}',
        '',
        'Date: {{mediation_date}}',
        'Time: {{mediation_time}}',
        'Venue: {{venue}}',
        '',
        'Issued by: {{admin_name}}',
        'Generated on: {{generated_at}}'
      ].join('\n')
    });
  };

  const openEditTemplateEditor = (template) => {
    setEditingTemplateId(template.id);
    setTemplateLogoDataUrl(template.logoDataUrl || '');
    templateForm.setFieldsValue({
      name: template.name,
      subject: template.subject,
      body: template.body
    });
  };

  const saveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      const templatePayload = {
        id: editingTemplateId || `tpl-${Date.now()}`,
        name: values.name,
        subject: values.subject,
        body: values.body,
        logoDataUrl: templateLogoDataUrl || ''
      };

      const nextTemplates = editingTemplateId
        ? subpoenaTemplates.map((template) => template.id === editingTemplateId ? templatePayload : template)
        : [...subpoenaTemplates, templatePayload];

      persistTemplates(nextTemplates);
      setSelectedTemplateId(templatePayload.id);
      persistDraft({ selectedTemplateId: templatePayload.id, templateLogoDataUrl: templatePayload.logoDataUrl });
      message.success('Template saved successfully');
      resetTemplateEditor();
    } catch (error) {
      // Form validation handles user-facing errors.
    }
  };

  const deleteTemplate = (templateId) => {
    const nextTemplates = subpoenaTemplates.filter((template) => template.id !== templateId);
    persistTemplates(nextTemplates);

    if (selectedTemplateId === templateId) {
      setSelectedTemplateId('default');
      persistDraft({ selectedTemplateId: 'default' });
    }

    if (editingTemplateId === templateId) {
      resetTemplateEditor();
    }

    message.success('Template deleted');
  };

  const complaintTypes = [
    'Infrastructure',
    'Service Quality',
    'Safety',
    'Environmental',
    'Health',
    'Education',
    'Others'
  ];

  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  const handleUploadChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  const isVideoFile = (fileItem) => {
    const mimeType = fileItem?.type || fileItem?.originFileObj?.type || '';
    const fileName = (fileItem?.name || fileItem?.filename || '').toLowerCase();
    return mimeType.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(fileName);
  };

  const getFilePreviewUrl = (fileItem) => {
    if (fileItem?.url) return fileItem.url;
    if (fileItem?.thumbUrl) return fileItem.thumbUrl;
    if (fileItem?.originFileObj) {
      if (!fileItem.localPreviewUrl) {
        fileItem.localPreviewUrl = URL.createObjectURL(fileItem.originFileObj);
      }
      return fileItem.localPreviewUrl;
    }
    return null;
  };

  const handleUserSearch = async () => {
    if (!searchFirstName.trim() && !searchLastName.trim()) {
      message.warning('Please enter first name or last name');
      return;
    }

    setSearchLoading(true);
    try {
      // Create search term combining both first and last names
      let searchQuery = '';
      if (searchFirstName.trim()) searchQuery += searchFirstName.trim();
      if (searchLastName.trim()) {
        if (searchQuery) searchQuery += ' ';
        searchQuery += searchLastName.trim();
      }

      const response = await adminAPI.getUsers({ search: searchQuery, limit: 10 });
      if (response.data.success) {
        setSearchResults(response.data.data.users);
        if (response.data.data.users.length === 0) {
          message.info('No existing users found with that search term');
        }
      }
    } catch (error) {
      if (error.response?.status === 429) {
        message.error('Too many search requests. Please wait a moment and try again.');
      } else {
        message.error('Failed to search users');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectUser = (selectedUser) => {
    const address = selectedUser.address || {};
    const completeAddress = [
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

    form.setFieldsValue({
      citizenFirstName: selectedUser.firstName || '',
      citizenMiddleName: selectedUser.middleName || '',
      citizenLastName: selectedUser.lastName || '',
      citizenName: `${selectedUser.firstName} ${selectedUser.middleName ? selectedUser.middleName + ' ' : ''}${selectedUser.lastName}`,
      citizenContact: selectedUser.phoneNumber || '',
      citizenEmail: selectedUser.email || '',
      citizenBarangay: address.barangay || '',
      citizenPurok: address.purok || '',
      citizenStreet: address.street || '',
      citizenAddress: completeAddress,
    });
    setSearchResults([]);
    setSearchFirstName('');
    setSearchLastName('');
    persistDraft();
    message.success('User details filled automatically');
  };

  const handleCreateAccount = async (values) => {
    setCreateAccountLoading(true);
    try {
      const userData = {
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        email: values.email || undefined,
        password: values.password || undefined,
        phoneNumber: values.phoneNumber,
        address: {
          barangay: values.barangay,
          purok: values.purok,
          street: values.street || '',
          city: values.city || 'Default City',
          province: values.province || 'Default Province'
        }
      };

      const response = await adminAPI.createUser(userData);
      
      if (response.data.success) {
        message.success('Account created successfully! User details have been filled.');
        setCreateAccountModalVisible(false);
        // Optionally search again to show the new user
        handleUserSearch();
        persistDraft();
      } else {
        message.error(response.data.message || 'Failed to create account');
      }
    } catch (error) {
      console.error('Create account error:', error);
      const serverMessage = error.response?.data?.message;
      const validationErrors = error.response?.data?.errors?.map(err => err.msg).join(', ');
      message.error(validationErrors || serverMessage || 'Failed to create account');
    } finally {
      setCreateAccountLoading(false);
    }
  };

  const handleDefendantSearch = async () => {
    if (!defendantSearchFirstName.trim() && !defendantSearchLastName.trim()) {
      message.warning('Please enter first name or last name');
      return;
    }
    setDefendantSearchLoading(true);
    try {
      let searchQuery = '';
      if (defendantSearchFirstName.trim()) searchQuery += defendantSearchFirstName.trim();
      if (defendantSearchLastName.trim()) {
        if (searchQuery) searchQuery += ' ';
        searchQuery += defendantSearchLastName.trim();
      }

      const response = await adminAPI.getUsers({ search: searchQuery, limit: 10 });
      if (response.data.success) {
        setDefendantSearchResults(response.data.data.users);
        if (response.data.data.users.length === 0) {
          message.info('No users found with that search term');
        }
      }
    } catch (error) {
      message.error('Failed to search users');
    } finally {
      setDefendantSearchLoading(false);
    }
  };

  const handleSelectDefendant = (defendant) => {
    setSelectedDefendant(defendant);
    setDefendantSearchResults([]);
    setDefendantSearchFirstName('');
    setDefendantSearchLastName('');
    persistDraft();
    message.success(`${defendant.firstName} ${defendant.lastName} selected as defendant`);
  };

  const handlePrintSubpoena = () => {
    const values = form.getFieldsValue(true);
    const selectedTemplate = getSelectedTemplate();
    const subject = values.subpoenaSubject || applyTokens(selectedTemplate?.subject || 'Subpoena Notice - {{case_title}}', values);
    const body = values.subpoenaBody || (selectedTemplateId === 'default'
      ? buildDefaultSubpoenaBody(values)
      : applyTokens(selectedTemplate?.body || '', values));
    const complainantName = values.citizenName || 'Complainant/Plaintiff';
    const defendantName = selectedDefendant
      ? `${selectedDefendant.firstName} ${selectedDefendant.lastName}`
      : values.defendantName || 'Defendant';

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      message.error('Unable to open print preview. Please allow pop-ups for this site.');
      return;
    }

    const safeText = (text) => (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    printWindow.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>${safeText(subject)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 24px; }
          .meta { margin-bottom: 16px; }
          .label { font-weight: bold; }
          .content { white-space: pre-wrap; border: 1px solid #ddd; padding: 16px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          ${selectedTemplate?.logoDataUrl ? `<img src="${selectedTemplate.logoDataUrl}" alt="Barangay Logo" style="max-height: 90px; margin-bottom: 12px;" />` : ''}
          <h2>Subpoena / Mediation Notice</h2>
          <h3>${safeText(subject)}</h3>
        </div>
        <div class="meta"><span class="label">Complainant/Plaintiff:</span> ${safeText(complainantName)}</div>
        <div class="meta"><span class="label">Defendant:</span> ${safeText(defendantName)}</div>
        <div class="meta"><span class="label">Printed on:</span> ${safeText(new Date().toLocaleString())}</div>
        <div class="content">${safeText(body)}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const draftValues = getSavedDraftValues();
      const submissionValues = {
        ...draftValues,
        ...draftFormValues,
        ...values
      };

      console.log('Submitting manual blotter:', submissionValues);

      let uploadedAttachments = [];
      if (fileList.length > 0) {
        const uploadFailures = [];

        for (const fileItem of fileList) {
          const rawFile = fileItem.originFileObj || fileItem;
          if (!rawFile) {
            uploadFailures.push({
              name: fileItem?.name || 'attachment',
              message: 'File object is missing'
            });
            continue;
          }

          try {
            const formData = new FormData();
            formData.append('attachment', rawFile, rawFile.name || fileItem.name || 'attachment');

            const uploadResponse = await adminAPI.uploadAttachment(formData);
            const attachment = uploadResponse.data?.data?.attachment;
            if (attachment) {
              uploadedAttachments.push(attachment);
            } else {
              uploadFailures.push({
                name: rawFile.name || fileItem.name || 'attachment',
                message: 'No attachment data returned by server'
              });
            }
          } catch (uploadError) {
            console.error('Attachment upload error:', uploadError.response?.data || uploadError);
            uploadFailures.push({
              name: rawFile.name || fileItem.name || 'attachment',
              message: uploadError.response?.data?.message || uploadError.message || 'Upload failed'
            });
          }
        }

        if (uploadFailures.length > 0) {
          const firstFailure = uploadFailures[0];
          message.warning(`${uploadFailures.length} attachment(s) were skipped. First issue: ${firstFailure.message}`);
        }

        if (fileList.length > 0 && uploadedAttachments.length === 0) {
          message.error('None of the selected attachments were uploaded. Please retry before submitting the blotter.');
          setLoading(false);
          return;
        }
      }

      // Check if mediation is required and defendant is selected
      if (submissionValues.mediationRequired === 'yes' && !selectedDefendant) {
        message.error('Please select a defendant for mediation');
        setLoading(false);
        return;
      }

      const blotterData = {
        title: submissionValues.title,
        caseTitle: submissionValues.title,
        blotterTitle: submissionValues.title,
        description: submissionValues.description,
        blotterDescription: submissionValues.description,
        category: submissionValues.category || 'Others',
        priority: submissionValues.priority || 'Medium',
        location: submissionValues.location,
        reportedBy: submissionValues.citizenName,
        plaintiffName: submissionValues.citizenName,
        complainantName: submissionValues.citizenName,
        defendantName: selectedDefendant ? `${selectedDefendant.firstName} ${selectedDefendant.lastName}` : 'TBD',
        incidentDate: submissionValues.incidentDate ? submissionValues.incidentDate.toISOString?.() || submissionValues.incidentDate : null,
        mediationRequired: submissionValues.mediationRequired,
        mediationNotes: submissionValues.mediationNotes,
        mediationDate: mediationDate ? mediationDate.toISOString() : null,
        mediationTime: mediationTime ? mediationTime.format('HH:mm') : null,
        defendant: selectedDefendant ? selectedDefendant._id : null,
        subpoenaEnabled: !!submissionValues.subpoenaEnabled,
        subpoenaSubject: submissionValues.subpoenaSubject,
        subpoenaBody: submissionValues.subpoenaBody,
        complainantEmail: submissionValues.citizenEmail,
        defendantEmail: selectedDefendant?.email,
        sendSubpoenaEmail: !!submissionValues.sendSubpoenaEmail
        ,
        attachments: uploadedAttachments
      };

      const response = await adminAPI.createManualBlotter(blotterData);
      
      if (response.data.success) {
        const emailResult = response.data.data.subpoenaEmailResult;
        if (emailResult && !emailResult.success) {
          message.warning(`Blotter logged, but subpoena email was not sent: ${emailResult.message || 'Email send failed'}`);
        }
        form.resetFields();
        setFileList([]);
        setSelectedDefendant(null);
        setDefendantSearchFirstName('');
        setDefendantSearchLastName('');
        setMediationDate(null);
        setMediationTime(null);
        setCurrentStep(4);
        setSubmissionComplete(true);
        setSubmittedCaseNumber(response.data.data.caseNumber || '');
        clearDraft();
      } else {
        message.error(response.data.message || 'Failed to log blotter');
      }
    } catch (error) {
      console.error('Manual blotter submit error', error.response?.data || error);
      const serverMessage = error.response?.data?.message;
      const validationErrors = error.response?.data?.errors?.map(err => err.msg).join(', ');
      message.error(validationErrors || serverMessage || 'Error logging blotter');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: 'Citizen Information',
      content: (
        <>
          <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
            <Text strong>Search Existing Citizen Account</Text>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <Input
                  placeholder="Enter first name"
                  value={searchFirstName}
                  onChange={(e) => setSearchFirstName(e.target.value)}
                  onPressEnter={handleUserSearch}
                />
              </Col>
              <Col span={12}>
                <Input
                  placeholder="Enter last name"
                  value={searchLastName}
                  onChange={(e) => setSearchLastName(e.target.value)}
                  onPressEnter={handleUserSearch}
                />
              </Col>
            </Row>
            <Button 
              type="primary" 
              onClick={handleUserSearch} 
              loading={searchLoading}
              icon={<UserOutlined />}
              style={{ marginTop: 8 }}
              block
            >
              Search
            </Button>
            {searchResults.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>Found Users:</Text>
                <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {searchResults.map(user => (
                    <Card 
                      key={user._id} 
                      size="small" 
                      style={{ marginBottom: 8, cursor: 'pointer' }}
                      onClick={() => handleSelectUser(user)}
                    >
                      <div>
                        <Text strong>{user.firstName} {user.middleName} {user.lastName}</Text>
                        <br />
                        <Text type="secondary">{user.email} | {user.phoneNumber}</Text>
                      </div>
                    </Card>
                  ))}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Click on a user to auto-fill the form
                </Text>
              </div>
            )}
            {(searchFirstName || searchLastName) && searchResults.length === 0 && !searchLoading && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Text type="secondary">No existing users found.</Text>
                <br />
                <Button 
                  type="primary" 
                  icon={<UserAddOutlined />} 
                  onClick={() => setCreateAccountModalVisible(true)}
                  style={{ marginTop: 8 }}
                >
                  Create New Account
                </Button>
              </div>
            )}
          </div>
          
          <Form.Item
            name="citizenFirstName"
            label="First Name"
          >
            <Input placeholder="First name" disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>
          <Form.Item
            name="citizenMiddleName"
            label="Middle Name"
          >
            <Input placeholder="Middle name" disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>
          <Form.Item
            name="citizenLastName"
            label="Last Name"
          >
            <Input placeholder="Last name" disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>
          <Form.Item
            name="citizenName"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter citizen name' }]}
          >
            <Input placeholder="Enter citizen's full name" />
          </Form.Item>
          <Form.Item
            name="citizenContact"
            label="Contact Number"
            rules={[{ required: true, message: 'Please enter contact number' }]}
          >
            <Input placeholder="Enter citizen's phone number" />
          </Form.Item>
          <Form.Item
            name="citizenEmail"
            label="Email Address"
          >
            <Input placeholder="Email address" type="email" disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>
          <Form.Item
            name="citizenBarangay"
            label="Address - Barangay"
          >
            <Input placeholder="Barangay" disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>
          <Form.Item
            name="citizenPurok"
            label="Address - Purok"
          >
            <Input placeholder="Purok/Sitio" disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>
          <Form.Item
            name="citizenStreet"
            label="Address - Street"
          >
            <Input placeholder="Street address" disabled style={{ backgroundColor: '#f5f5f5' }} />
          </Form.Item>
          <Form.Item
            name="citizenAddress"
            label="Complete Address"
            rules={[{ required: true, message: 'Please enter address' }]}
          >
            <TextArea rows={3} placeholder="Enter citizen's address" />
          </Form.Item>
        </>
      ),
    },
    {
      title: 'Blotter Details',
      content: (
        <>
          <Form.Item
            name="title"
            label="Blotter Title"
            rules={[{ required: true, message: 'Please enter blotter title' }]}
          >
            <Input placeholder="Enter brief blotter title" />
          </Form.Item>
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select blotter category">
              {complaintTypes.map(type => (
                <Select.Option key={type} value={type}>{type}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="priority"
            label="Priority"
            rules={[{ required: true, message: 'Please select priority' }]}
          >
            <Select placeholder="Select priority level">
              {priorities.map(priority => (
                <Select.Option key={priority} value={priority}>{priority}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="Provide detailed description of the blotter"
              showCount
            />
          </Form.Item>
        </>
      ),
    },
    {
      title: 'Evidence & Location',
      content: (
        <>
          <Form.Item
            name="location"
            label="Location"
            rules={[{ required: true, message: 'Please enter location' }]}
          >
            <Input placeholder="Enter specific location" />
          </Form.Item>
          <Form.Item
            name="incidentDate"
            label="Incident Date"
            rules={[{ required: true, message: 'Please select date' }]}
          >
            <DatePicker 
              style={{ width: '100%' }}
              placeholder="Select date of incident"
            />
          </Form.Item>
          <Form.Item
            label="Evidence (Photos/Videos)"
          >
            <Upload
              beforeUpload={() => false}
              accept="image/*,video/*"
              fileList={fileList}
              onChange={handleUploadChange}
              maxCount={5}
              multiple
              showUploadList={true}
            >
              <Button icon={<UploadOutlined />}>Upload Photo or Video</Button>
            </Upload>
          </Form.Item>
        </>
      ),
    },
    {
      title: 'Mediation',
      content: (
        <>
          <Form.Item
            name="mediationRequired"
            label="Does this blotter require mediation?"
            rules={[{ required: true, message: 'Please select whether this blotter requires mediation' }]}
          >
            <Select placeholder="Select option">
              <Select.Option value="yes">Yes</Select.Option>
              <Select.Option value="no">No</Select.Option>
            </Select>
          </Form.Item>

          {mediationRequired === 'yes' && (
            <>
              <Divider>Defendant Information</Divider>
              
              {selectedDefendant ? (
                <Card 
                  style={{ marginBottom: 16, backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckOutlined style={{ color: '#52c41a' }} />
                      <Text strong>Defendant Selected</Text>
                    </div>
                  }
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Text strong>Name: </Text>
                      <Text>{selectedDefendant.firstName} {selectedDefendant.middleName} {selectedDefendant.lastName}</Text>
                    </Col>
                    <Col span={12}>
                      <Text strong>Phone: </Text>
                      <Text>{selectedDefendant.phoneNumber}</Text>
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={12}>
                      <Text strong>Email: </Text>
                      <Text>{selectedDefendant.email}</Text>
                    </Col>
                    <Col span={12}>
                      <Button 
                        size="small" 
                        onClick={() => {
                          setSelectedDefendant(null);
                          setDefendantSearchFirstName('');
                          setDefendantSearchLastName('');
                        }}
                      >
                        Clear Selection
                      </Button>
                    </Col>
                  </Row>
                </Card>
              ) : (
                <Card 
                  style={{ marginBottom: 16, backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}
                  title={<Text>Search for Defendant</Text>}
                >
                  <Row gutter={16} style={{ marginBottom: 12 }}>
                    <Col span={12}>
                      <Input
                        placeholder="Enter first name"
                        value={defendantSearchFirstName}
                        onChange={(e) => setDefendantSearchFirstName(e.target.value)}
                        onPressEnter={handleDefendantSearch}
                      />
                    </Col>
                    <Col span={12}>
                      <Input
                        placeholder="Enter last name"
                        value={defendantSearchLastName}
                        onChange={(e) => setDefendantSearchLastName(e.target.value)}
                        onPressEnter={handleDefendantSearch}
                      />
                    </Col>
                  </Row>
                  <Button 
                    type="primary" 
                    onClick={handleDefendantSearch} 
                    loading={defendantSearchLoading}
                    icon={<SearchOutlined />}
                    block
                  >
                    Search Defendant
                  </Button>
                  
                  {defendantSearchResults.length > 0 && (
                    <div style={{ marginTop: 16, maxHeight: 300, overflowY: 'auto' }}>
                      <Text strong>Found Users:</Text>
                      {defendantSearchResults.map(user => (
                        <Card 
                          key={user._id} 
                          size="small" 
                          style={{ marginBottom: 8, cursor: 'pointer', paddingTop: 8 }}
                          hoverable
                          onClick={() => handleSelectDefendant(user)}
                        >
                          <div>
                            <Text strong>{user.firstName} {user.middleName} {user.lastName}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>{user.email} | {user.phoneNumber}</Text>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {(defendantSearchFirstName || defendantSearchLastName) && defendantSearchResults.length === 0 && !defendantSearchLoading && (
                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                      <Empty 
                        description="No users found" 
                        style={{ marginTop: 16 }}
                      />
                    </div>
                  )}
                </Card>
              )}

              <Divider>Mediation Details</Divider>
              
              <Form.Item
                name="mediationNotes"
                label="Mediation Notes"
              >
                <TextArea rows={4} placeholder="Enter any notes for mediation" />
              </Form.Item>

              <Form.Item label="Mediation Schedule">
                <Calendar
                  fullscreen={false}
                  onSelect={(date) => {
                    setMediationDate(date);
                    persistDraft({ mediationDate: date ? date.toISOString() : null });
                  }}
                />
                {mediationDate && (
                  <Text type="secondary">
                    Selected: {mediationDate.format('YYYY-MM-DD')}
                  </Text>
                )}
              </Form.Item>

              <Form.Item name="mediationTime" label="Mediation Time">
                <TimePicker
                  format="HH:mm"
                  minuteStep={15}
                    onChange={(time) => {
                      setMediationTime(time);
                      persistDraft({ mediationTime: time ? time.format('HH:mm') : null });
                    }}
                  disabledHours={() => [0,1,2,3,4,5,6,7,18,19,20,21,22,23]}
                />
              </Form.Item>

              <Divider>Subpoena Document Editor</Divider>

              <Form.Item name="subpoenaEnabled" valuePropName="checked">
                <Checkbox>Enable Subpoena Document</Checkbox>
              </Form.Item>

              {subpoenaEnabled && (
                <>
                  <Form.Item label="Template">
                    <Row gutter={12}>
                      <Col xs={24} md={10}>
                        <Select
                          value={selectedTemplateId}
                          onChange={setSelectedTemplateId}
                          options={[
                            { value: 'default', label: 'Default Template' },
                            ...subpoenaTemplates.map((template) => ({
                              value: template.id,
                              label: template.name
                            }))
                          ]}
                        />
                      </Col>
                      <Col>
                        <Button onClick={applySelectedTemplate}>Apply Template</Button>
                      </Col>
                      <Col>
                        <Button
                          onClick={() => {
                            setTemplateModalVisible(true);
                            openNewTemplateEditor();
                          }}
                        >
                          Manage Templates
                        </Button>
                      </Col>
                    </Row>
                  </Form.Item>

                  <Form.Item
                    name="subpoenaSubject"
                    label="Subpoena Subject"
                    rules={[{ required: true, message: 'Please enter subpoena subject' }]}
                  >
                    <Input placeholder="e.g., Subpoena Notice - Mediation Schedule" />
                  </Form.Item>

                  <Form.Item
                    name="subpoenaBody"
                    label="Subpoena Content"
                    rules={[{ required: true, message: 'Please enter subpoena content' }]}
                  >
                    <TextArea
                      rows={12}
                      placeholder="Write the subpoena here"
                      showCount
                      maxLength={10000}
                    />
                  </Form.Item>

                  <Row gutter={12} style={{ marginBottom: 12 }}>
                    <Col>
                      <Button
                        onClick={() => {
                          setSelectedTemplateId('default');
                          applySelectedTemplate();
                        }}
                      >
                        Use Default Template
                      </Button>
                    </Col>
                    <Col>
                      <Button onClick={handlePrintSubpoena}>
                        Print Document
                      </Button>
                    </Col>
                  </Row>

                  <Card size="small" style={{ marginBottom: 12, backgroundColor: '#fafafa' }}>
                    <Text strong>Recipients</Text>
                    <br />
                    <Text>Complainant/Plaintiff: {form.getFieldValue('citizenEmail') || 'No email available'}</Text>
                    <br />
                    <Text>Defendant: {selectedDefendant?.email || 'No email available'}</Text>
                  </Card>

                  <Form.Item name="sendSubpoenaEmail" valuePropName="checked">
                    <Checkbox>Send subpoena by email after submitting this blotter</Checkbox>
                  </Form.Item>
                </>
              )}
            </>
          )}

          {mediationRequired === 'no' && (
            <Card style={{ textAlign: 'center', backgroundColor: '#f0f2f5' }}>
              <Text type="secondary">This blotter does not require mediation</Text>
            </Card>
          )}
        </>
      ),
    },
    {
      title: 'Review & Submit',
      content: (
        <Form.Item noStyle shouldUpdate>
          {() => {
            const values = {
              ...draftFormValues,
              ...form.getFieldsValue(true)
            };
            const selectedTemplate = getSelectedTemplate();
            const subpoenaAttached = !!values.subpoenaEnabled;
            const subpoenaWillSend = subpoenaAttached && !!values.sendSubpoenaEmail;
            const complainantEmail = values.citizenEmail || '';
            const defendantEmail = selectedDefendant?.email || '';
            const subjectPreview = values.subpoenaSubject || applyTokens(selectedTemplate?.subject || 'Subpoena Notice - {{case_title}}', values);
            const bodyPreview = values.subpoenaBody || (selectedTemplateId === 'default'
              ? buildDefaultSubpoenaBody(values)
              : applyTokens(selectedTemplate?.body || '', values));

            const checklistItems = [
              {
                label: 'Subpoena document attached to blotter',
                checked: subpoenaAttached,
                detail: subpoenaAttached ? 'Subpoena editor is enabled.' : 'Subpoena editor is not enabled.'
              },
              {
                label: 'Subpoena content is prepared',
                checked: subpoenaAttached && !!subjectPreview && !!bodyPreview,
                detail: subpoenaAttached ? 'Subject and content are ready for review.' : 'Enable subpoena to prepare the document.'
              },
              {
                label: 'Complainant email available',
                checked: subpoenaAttached ? !!complainantEmail : true,
                detail: subpoenaAttached ? (complainantEmail || 'No complainant email on file.') : 'Not required when subpoena is disabled.'
              },
              {
                label: 'Defendant email available',
                checked: subpoenaAttached ? !!defendantEmail : true,
                detail: subpoenaAttached ? (defendantEmail || 'No defendant email on file.') : 'Not required when subpoena is disabled.'
              },
              {
                label: 'Send subpoena after successful submission',
                checked: subpoenaWillSend,
                detail: subpoenaWillSend
                  ? 'It will be emailed automatically after the blotter saves successfully.'
                  : 'Email sending is disabled for this blotter.'
              }
            ];

            return (
              <div>
                {submissionComplete ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                    <Result
                      status="success"
                      title="Blotter Submitted Successfully"
                      subTitle={`Case ID: ${submittedCaseNumber || 'N/A'}`}
                    />
                  </div>
                ) : (
                  <>
                <Title level={4}>Review Blotter Details</Title>
                <Text type="secondary">Review the summary below before submitting. This is what will be saved and, if enabled, emailed.</Text>

                <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                  <Col xs={24} md={12}>
                    <Card size="small" title="Citizen Information">
                      <p><Text strong>Name:</Text> {values.citizenName || 'N/A'}</p>
                      <p><Text strong>Contact:</Text> {values.citizenContact || 'N/A'}</p>
                      <p><Text strong>Email:</Text> {values.citizenEmail || 'N/A'}</p>
                      <p><Text strong>Address:</Text> {values.citizenAddress || 'N/A'}</p>
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card size="small" title="Blotter Details">
                      <p><Text strong>Title:</Text> {values.title || 'N/A'}</p>
                      <p><Text strong>Category:</Text> {values.category || 'N/A'}</p>
                      <p><Text strong>Priority:</Text> {values.priority || 'N/A'}</p>
                      <p><Text strong>Location:</Text> {values.location || 'N/A'}</p>
                      <p><Text strong>Incident Date:</Text> {values.incidentDate ? values.incidentDate.format('MMMM DD, YYYY') : 'N/A'}</p>
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card size="small" title="Mediation Details">
                      <p><Text strong>Mediation Required:</Text> {values.mediationRequired === 'yes' ? 'Yes' : 'No'}</p>
                      <p><Text strong>Defendant:</Text> {selectedDefendant ? `${selectedDefendant.firstName} ${selectedDefendant.lastName}` : 'N/A'}</p>
                      <p><Text strong>Mediation Date:</Text> {mediationDate ? mediationDate.format('MMMM DD, YYYY') : 'N/A'}</p>
                      <p><Text strong>Mediation Time:</Text> {mediationTime ? mediationTime.format('HH:mm') : 'N/A'}</p>
                      <p><Text strong>Notes:</Text> {values.mediationNotes || 'N/A'}</p>
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card size="small" title="Subpoena Summary">
                      <p>
                        <Text strong>Status:</Text>{' '}
                        {subpoenaAttached ? <Tag color="green">Attached</Tag> : <Tag color="default">Not Attached</Tag>}
                      </p>
                      <p><Text strong>Template:</Text> {selectedTemplate?.name || 'Default Template'}</p>
                      <p><Text strong>Subject:</Text> {subjectPreview || 'N/A'}</p>
                      <p><Text strong>Will email after submit:</Text>{' '}
                        {subpoenaWillSend ? <Tag color="blue">Yes</Tag> : <Tag color="default">No</Tag>}
                      </p>
                    </Card>
                  </Col>
                </Row>

                <Card size="small" title="Subpoena Checklist" style={{ marginTop: 16 }}>
                  {checklistItems.map((item) => (
                    <div key={item.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                      <Tag color={item.checked ? 'green' : 'red'} style={{ minWidth: 76, textAlign: 'center' }}>
                        {item.checked ? 'Ready' : 'Missing'}
                      </Tag>
                      <div>
                        <Text strong>{item.label}</Text>
                        <br />
                        <Text type="secondary">{item.detail}</Text>
                      </div>
                    </div>
                  ))}
                </Card>

                {fileList.length > 0 && (
                  <Card size="small" title="Attachments Preview" style={{ marginTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                      {fileList.map((fileItem, index) => {
                        const previewUrl = getFilePreviewUrl(fileItem);
                        const isVideo = isVideoFile(fileItem);

                        return (
                          <Card key={fileItem.uid || fileItem.name || index} size="small" bodyStyle={{ padding: 8 }}>
                            {previewUrl ? (
                              isVideo ? (
                                <video
                                  src={previewUrl}
                                  controls
                                  style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6 }}
                                />
                              ) : (
                                <img
                                  src={previewUrl}
                                  alt={fileItem.name || `attachment-${index + 1}`}
                                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }}
                                />
                              )
                            ) : (
                              <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', borderRadius: 6 }}>
                                <Text type="secondary">No preview</Text>
                              </div>
                            )}
                            <div style={{ marginTop: 8 }}>
                              <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: fileItem.name || fileItem.filename || 'Attachment' }}>
                                {fileItem.name || fileItem.filename || `Attachment ${index + 1}`}
                              </Text>
                              <br />
                              <Tag color={isVideo ? 'purple' : 'blue'} style={{ marginTop: 4 }}>
                                {isVideo ? 'Video' : 'Photo'}
                              </Tag>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {subpoenaAttached && (
                  <Card size="small" title="Subpoena Preview" style={{ marginTop: 16, textAlign: 'left' }}>
                    <Text strong>Subject</Text>
                    <br />
                    <Text>{subjectPreview || 'N/A'}</Text>
                    <Divider style={{ margin: '12px 0' }} />
                    <Text strong>Content</Text>
                    <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, marginBottom: 0 }}>{bodyPreview || 'N/A'}</pre>
                  </Card>
                )}

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => form.submit()}
                    loading={loading}
                  >
                    Submit Blotter
                  </Button>
                </div>
                  </>
                )}
              </div>
            );
          }}
        </Form.Item>
      ),
    },
  ];

  const stepFields = [
    ['citizenName', 'citizenContact', 'citizenAddress'],
    ['title', 'category', 'priority', 'description'],
    ['location', 'incidentDate'],
    ['mediationRequired'],
    [],
  ];

  const handleNext = async () => {
    try {
      await form.validateFields(stepFields[currentStep]);
      setCurrentStep((nextStep) => {
        const updatedStep = nextStep + 1;
        persistDraft({ currentStep: updatedStep });
        return updatedStep;
      });
    } catch (error) {
      // validation failed; stay on current step
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((previousStep) => {
        const updatedStep = previousStep - 1;
        persistDraft({ currentStep: updatedStep });
        return updatedStep;
      });
    }
  };

  const handleStepChange = async (step) => {
    if (step > currentStep) {
      try {
        await form.validateFields(stepFields[currentStep]);
      } catch (error) {
        return;
      }
    }

    setCurrentStep(step);
    persistDraft({ currentStep: step });
  };

  return (
    <div className="manual-complaint-container">
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0 }}>
              Manual Blotter Logging
            </Title>
          </div>
        }
        className="manual-complaint-card"
      >
        <Steps
          current={currentStep}
          size="small"
          onChange={handleStepChange}
        >
          <Step title="Citizen Info" icon={<UserOutlined />} />
          <Step title="Blotter Details" icon={<FileTextOutlined />} />
          <Step title="Evidence" icon={<UploadOutlined />} />
          <Step title="Mediation" icon={<TeamOutlined />} />
          <Step title="Review" icon={<EnvironmentOutlined />} />
        </Steps>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={(_, allValues) => persistDraft({}, allValues)}
          style={{ marginTop: 24 }}
        >
          {currentStep === 0 && steps[0].content}
          {currentStep === 1 && steps[1].content}
          {currentStep === 2 && steps[2].content}
          {currentStep === 3 && steps[3].content}
          {currentStep === 4 && steps[4].content}

          <Row justify="space-between" style={{ marginTop: 24 }}>
            <Col>
              {currentStep > 0 && (
                <Button
                  onClick={() => {
                    if (submissionComplete) {
                      setSubmissionComplete(false);
                      return;
                    }

                    handlePrev();
                  }}
                >
                  Previous
                </Button>
              )}
            </Col>
            <Col>
              {!submissionComplete && (currentStep < steps.length - 1 ? (
                <Button type="primary" onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button type="primary" loading={loading} onClick={() => form.submit()}>
                  Submit Blotter
                </Button>
              ))}
            </Col>
          </Row>
        </Form>
      </Card>

      <Modal
        title="Create New Citizen Account"
        open={createAccountModalVisible}
        onCancel={() => setCreateAccountModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          layout="vertical"
          onFinish={handleCreateAccount}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="First Name"
                name="firstName"
                rules={[{ required: true, message: 'Please enter first name' }]}
              >
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Middle Name"
                name="middleName"
                rules={[{ required: true, message: 'Please enter middle name' }]}
              >
                <Input placeholder="Middle name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Last Name"
                name="lastName"
                rules={[{ required: true, message: 'Please enter last name' }]}
              >
                <Input placeholder="Last name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Phone Number"
                name="phoneNumber"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <Input placeholder="Phone number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Email Address (Optional)"
                name="email"
                rules={[{ type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input placeholder="Email address" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Address - Barangay"
            name="barangay"
            rules={[{ required: true, message: 'Please enter barangay' }]}
          >
            <Input placeholder="Barangay" />
          </Form.Item>

          <Form.Item
            label="Address - Purok"
            name="purok"
            rules={[{ required: true, message: 'Please enter purok' }]}
          >
            <Input placeholder="Purok/Sitio" />
          </Form.Item>

          <Form.Item
            label="Address - Street (Optional)"
            name="street"
          >
            <Input placeholder="Street address" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Password (Optional)"
                name="password"
                rules={[{ min: 6, message: 'Password must be at least 6 characters' }]}
              >
                <Input.Password placeholder="Password" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Confirm Password (Optional)"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
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
                <Input.Password placeholder="Confirm password" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: 4 }}>
            <Text type="warning" strong>Note:</Text>
            <br />
            <Text type="secondary">Make sure to share the password you created to the user.</Text>
          </div>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setCreateAccountModalVisible(false)} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={createAccountLoading}>
              Create Account
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Manage Subpoena Templates"
        open={templateModalVisible}
        onCancel={() => {
          setTemplateModalVisible(false);
          resetTemplateEditor();
        }}
        onOk={saveTemplate}
        okText="Save Template"
        width={920}
      >
        <Row gutter={16}>
          <Col xs={24} md={14}>
            <Card size="small" title={editingTemplateId ? 'Edit Template' : 'New Template'}>
              <Form form={templateForm} layout="vertical">
                <Form.Item
                  name="name"
                  label="Template Name"
                  rules={[{ required: true, message: 'Please enter a template name' }]}
                >
                  <Input placeholder="e.g., Barangay Subpoena with Logo" />
                </Form.Item>

                <Form.Item
                  name="subject"
                  label="Subject Template"
                  rules={[{ required: true, message: 'Please enter a subject template' }]}
                >
                  <Input placeholder="Subpoena Notice - {{case_title}}" />
                </Form.Item>

                <Form.Item
                  name="body"
                  label="Body Template"
                  rules={[{ required: true, message: 'Please enter a body template' }]}
                >
                  <TextArea rows={11} placeholder="Use placeholders like {{complainant_name}}" />
                </Form.Item>

                <Form.Item label="Barangay Logo (Optional)">
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={handleTemplateLogoUpload}
                  >
                    <Button>Upload Logo</Button>
                  </Upload>
                  {templateLogoDataUrl && (
                    <div style={{ marginTop: 8 }}>
                      <img src={templateLogoDataUrl} alt="Template logo preview" style={{ maxHeight: 80 }} />
                    </div>
                  )}
                </Form.Item>

                <Text type="secondary">
                  {'Placeholders: {{case_title}}, {{complainant_name}}, {{defendant_name}}, {{mediation_date}}, {{mediation_time}}, {{venue}}, {{admin_name}}, {{generated_at}}'}
                </Text>
              </Form>
            </Card>
          </Col>

          <Col xs={24} md={10}>
            <Card
              size="small"
              title="Saved Templates"
              extra={<Button size="small" onClick={openNewTemplateEditor}>New</Button>}
            >
              {subpoenaTemplates.length === 0 ? (
                <Empty description="No custom templates yet" />
              ) : (
                subpoenaTemplates.map((template) => (
                  <Card key={template.id} size="small" style={{ marginBottom: 8 }}>
                    <Text strong>{template.name}</Text>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button size="small" onClick={() => openEditTemplateEditor(template)}>Edit</Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          const values = form.getFieldsValue(true);
                          form.setFieldsValue({
                            subpoenaSubject: applyTokens(template.subject || '', values),
                            subpoenaBody: applyTokens(template.body || '', values)
                          });
                          message.success(`Template applied: ${template.name}`);
                        }}
                      >
                        Apply
                      </Button>
                      <Button size="small" danger onClick={() => deleteTemplate(template.id)}>Delete</Button>
                    </div>
                  </Card>
                ))
              )}
            </Card>
          </Col>
        </Row>
      </Modal>
    </div>
  );
};

export default ManualComplaint;
