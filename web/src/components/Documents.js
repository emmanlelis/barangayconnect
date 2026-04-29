import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Space,
  message,
  Spin,
  Row,
  Col,
  List,
  Tag,
  Empty,
  Popconfirm
} from 'antd';
import {
  FileTextOutlined,
  SaveOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { adminAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;

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

const isHtmlContent = (value = '') => /<[^>]+>/.test(value);

const plainTextToHtml = (value = '') => String(value)
  .split('\n')
  .map((line) => (line.trim() ? line : '<br/>'))
  .join('');

const templateBodyToEditorValue = (value = '') => {
  if (!value) {
    return '';
  }

  return isHtmlContent(value) ? value : plainTextToHtml(value);
};

const stripHtmlTags = (html = '') => {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, '')
    .trim();
};

const isBodyContentEmpty = (bodyHtml = '') => {
  const cleanText = stripHtmlTags(bodyHtml);
  if (cleanText && cleanText.length > 0) {
    return false;
  }

  return !/<img\b[^>]*>/i.test(String(bodyHtml || ''));
};

const resolveUploadedImageUrl = (uploadResponse) => (
  uploadResponse?.data?.data?.image?.url
  || uploadResponse?.data?.data?.image?.secure_url
  || uploadResponse?.data?.data?.image?.secureUrl
  || uploadResponse?.data?.data?.image?.path
  || ''
);

const Documents = () => {
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState('');

  const bodyEditorRef = useRef(null);

  const watchedBodyTemplate = Form.useWatch('bodyTemplate', form);

  const currentTemplate = useMemo(() => (
    templates.find((item) => item.key === activeTemplateKey) || null
  ), [templates, activeTemplateKey]);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDocumentTemplates();
      if (!response?.data?.success) {
        throw new Error('Failed to load templates');
      }

      const nextTemplates = response.data.data?.templates || [];
      setTemplates(nextTemplates);

      if (!isCreating) {
        if (nextTemplates.length === 0) {
          setActiveTemplateKey('');
          return;
        }

        const stillExists = nextTemplates.some((item) => item.key === activeTemplateKey);
        if (!activeTemplateKey || !stillExists) {
          setActiveTemplateKey(nextTemplates[0].key);
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      message.error(error?.response?.data?.message || 'Failed to load document templates');
    } finally {
      setLoading(false);
    }
  }, [activeTemplateKey, isCreating]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (isCreating) {
      return;
    }

    if (!currentTemplate) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      name: currentTemplate.name || '',
      description: currentTemplate.description || '',
      subjectTemplate: currentTemplate.subjectTemplate || '',
      bodyTemplate: templateBodyToEditorValue(currentTemplate.bodyTemplate || '')
    });
  }, [currentTemplate, isCreating, form]);

  const handleInsertImageToEditor = useCallback(async () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      try {
        const formData = new FormData();
        formData.append('image', file);

        const uploadResponse = await adminAPI.uploadSingleImage(formData);
        const imageUrl = resolveUploadedImageUrl(uploadResponse);

        if (!imageUrl) {
          message.error('Image upload succeeded but no URL was returned.');
          return;
        }

        const quill = bodyEditorRef.current?.getEditor();
        if (!quill) {
          message.error('Editor is not ready. Please try again.');
          return;
        }

        const selection = quill.getSelection(true);
        const insertIndex = selection ? selection.index : quill.getLength();
        quill.insertEmbed(insertIndex, 'image', imageUrl, 'user');
        quill.setSelection(insertIndex + 1, 0, 'user');

        const nextHtml = quill.root.innerHTML;
        form.setFieldsValue({ bodyTemplate: nextHtml });
      } catch (error) {
        console.error('Image insert error:', error.response?.data || error);
        message.error(error?.response?.data?.message || 'Failed to upload image');
      }
    };

    input.click();
  }, [form]);

  const editorModules = useMemo(() => ({
    toolbar: {
      container: RICH_TEXT_TOOLBAR,
      handlers: {
        image: handleInsertImageToEditor
      }
    }
  }), [handleInsertImageToEditor]);

  const startNewTemplate = () => {
    setIsCreating(true);
    setActiveTemplateKey('');
    form.setFieldsValue({
      name: '',
      description: '',
      subjectTemplate: '',
      bodyTemplate: ''
    });
  };

  const selectTemplate = (templateKey) => {
    setIsCreating(false);
    setActiveTemplateKey(templateKey);
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await form.validateFields();

      // Check if body content is actually empty
      if (isBodyContentEmpty(values.bodyTemplate)) {
        message.error('Template body cannot be empty. Please add content to your template.');
        return;
      }

      const payload = {
        name: values.name,
        description: values.description || '',
        subjectTemplate: values.subjectTemplate || '',
        bodyTemplate: values.bodyTemplate || ''
      };

      setSaving(true);

      if (isCreating) {
        const response = await adminAPI.createDocumentTemplate(payload);
        if (!response?.data?.success) {
          throw new Error('Failed to create template');
        }

        const savedTemplate = response.data.data?.template;
        message.success('Template created successfully');
        setIsCreating(false);
        await loadTemplates();
        if (savedTemplate?.key) {
          setActiveTemplateKey(savedTemplate.key);
        }
      } else if (currentTemplate?.key) {
        const response = await adminAPI.updateDocumentTemplate(currentTemplate.key, payload);
        if (!response?.data?.success) {
          throw new Error('Failed to update template');
        }

        const savedTemplate = response.data.data?.template;
        message.success('Template updated successfully');
        setTemplates((prev) => prev.map((item) => (item.key === savedTemplate.key ? savedTemplate : item)));
      }
    } catch (error) {
      if (error?.errorFields) {
        return;
      }

      console.error('Failed to save template:', error);
      const validationDetails = Array.isArray(error?.response?.data?.errors) && error.response.data.errors.length > 0
        ? error.response.data.errors
            .map((item) => item.msg || `${item.param}: invalid value`)
            .join('; ')
        : '';
      const errorMsg = validationDetails
        || error?.response?.data?.details 
        || error.message 
        || 'Failed to save template';
      message.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    try {
      setDeletingKey(template.key);
      const response = await adminAPI.deleteDocumentTemplate(template.key);
      if (!response?.data?.success) {
        throw new Error('Failed to delete template');
      }

      message.success(response.data.message || 'Template deleted successfully');
      if (template.key === activeTemplateKey) {
        setActiveTemplateKey('');
      }
      await loadTemplates();
    } catch (error) {
      console.error('Delete template failed:', error);
      message.error(error?.response?.data?.message || 'Failed to delete template');
    } finally {
      setDeletingKey('');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              <FileTextOutlined /> Documents
            </Title>
            <Text type="secondary">
              Create, edit, and manage letter templates. Use the editor controls for formatting, alignment, and image insertion.
            </Text>
          </div>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Card
                size="small"
                title="Saved Templates"
                extra={(
                  <Space>
                    <Button size="small" icon={<ReloadOutlined />} onClick={loadTemplates}>Reload</Button>
                    <Button size="small" type="primary" icon={<PlusOutlined />} onClick={startNewTemplate}>New</Button>
                  </Space>
                )}
              >
                {templates.length === 0 ? (
                  <Empty description="No templates found" />
                ) : (
                  <List
                    dataSource={templates}
                    renderItem={(item) => {
                      const isSelected = !isCreating && activeTemplateKey === item.key;
                      const isSystemTemplate = ['subpoena', 'certificate_to_file_action'].includes(item.key);

                      return (
                        <List.Item style={{ padding: 0, border: 'none', marginBottom: 8 }}>
                          <Card
                            size="small"
                            hoverable
                            onClick={() => selectTemplate(item.key)}
                            style={{
                              width: '100%',
                              borderColor: isSelected ? '#1677ff' : undefined,
                              background: isSelected ? '#e6f4ff' : undefined
                            }}
                          >
                            <Space direction="vertical" style={{ width: '100%' }} size={6}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <Text strong>{item.name}</Text>
                                {isSystemTemplate && <Tag color="blue">System</Tag>}
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>{item.subjectTemplate || 'No subject'}</Text>
                              <div>
                                <Popconfirm
                                  title={isSystemTemplate ? 'Remove customization and restore default?' : 'Delete this template?'}
                                  onConfirm={() => handleDeleteTemplate(item)}
                                  okText="Delete"
                                  cancelText="Cancel"
                                >
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={deletingKey === item.key}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {isSystemTemplate ? 'Reset' : 'Delete'}
                                  </Button>
                                </Popconfirm>
                              </div>
                            </Space>
                          </Card>
                        </List.Item>
                      );
                    }}
                  />
                )}
              </Card>
            </Col>

            <Col xs={24} md={16}>
              <Card size="small" title={isCreating ? 'New Template' : 'Template Editor'}>
                <Form form={form} layout="vertical">
                  <Form.Item
                    label="Template Name"
                    name="name"
                    rules={[{ required: true, message: 'Template name is required' }]}
                  >
                    <Input maxLength={120} />
                  </Form.Item>

                  <Form.Item label="Description" name="description">
                    <Input maxLength={500} />
                  </Form.Item>

                  <Form.Item label="Subject" name="subjectTemplate">
                    <Input maxLength={200} placeholder="Optional subject line for this template" />
                  </Form.Item>

                  <Form.Item
                    label="Body Template"
                    name="bodyTemplate"
                    rules={[
                      { required: true, message: 'Body template is required' },
                      {
                        validator: (_, value) => {
                          if (isBodyContentEmpty(value)) {
                            return Promise.reject(new Error('Template body cannot be empty. Please add content.'));
                          }
                          return Promise.resolve();
                        }
                      }
                    ]}
                  >
                    <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
                      <ReactQuill
                        ref={bodyEditorRef}
                        theme="snow"
                        value={watchedBodyTemplate || ''}
                        onChange={(content) => form.setFieldsValue({ bodyTemplate: content })}
                        modules={editorModules}
                        formats={RICH_TEXT_FORMATS}
                        placeholder="Write your template content here"
                        style={{ minHeight: 280, background: '#fff' }}
                      />
                    </div>
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 0 }}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={handleSaveTemplate}
                      >
                        {isCreating ? 'Create Template' : 'Save Changes'}
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={loadTemplates}>
                        Reload
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>

          <Card size="small" title="Notes" style={{ background: '#fafafa' }}>
            <Paragraph style={{ marginBottom: 8 }}>
              You can directly format template content (bold, align center, insert images, etc.) using the toolbar.
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              Template fields are now manually editable in Letter Generation, so placeholders are optional.
            </Paragraph>
          </Card>
        </Space>
      </Card>
    </div>
  );
};

export default Documents;
