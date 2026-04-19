import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Steps, Button, Space, Tag, Statistic, Table, Timeline, Progress, Avatar, Badge, Tooltip } from 'antd';
import { 
  DashboardOutlined, 
  FileTextOutlined, 
  UserOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  ExclamationCircleOutlined,
  BellOutlined,
  TrophyOutlined,
  SafetyOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { adminAPI } from '../services/api';

const { Title, Text } = Typography;

const AdminWorkflow = () => {
  const [workflowData, setWorkflowData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    loadWorkflowData();
  }, []);

  const loadWorkflowData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getWorkflowStats();
      if (response.data.success) {
        setWorkflowData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStepColor = (step) => {
    const colors = ['#1890ff', '#52c41a', '#13c2c2', '#faad14', '#389e0d', '#52c41a'];
    return colors[step] || '#d9d9d9';
  };

  const getWorkflowIcon = (type) => {
    const icons = {
      pending: <FileTextOutlined style={{ color: '#faad14' }} />,
      in_progress: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
      under_review: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
      resolved: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      closed: <TrophyOutlined style={{ color: '#389e0d' }} />,
      rejected: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    };
    return icons[type] || <FileTextOutlined />;
  };

  const getCompletionRate = () => {
    if (!workflowData) return 0;
    const { total, resolved, closed, rejected, pending, inProgress, underReview } = workflowData;
    const completed = resolved + closed;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getAverageResolutionTime = () => {
    if (!workflowData || !workflowData.averageResolutionTime) return '0 days';
    return workflowData.averageResolutionTime;
  };

  const getEfficiencyScore = () => {
    if (!workflowData) return 0;
    const { resolutionRate, responseRate } = workflowData;
    return Math.round((resolutionRate * 0.6) + (responseRate * 0.4));
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Progress type="circle" percent={100} />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>BarangayConnect Admin Workflow</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="Workflow Overview">
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Statistic
                  title="Total Complaints"
                  value={workflowData?.total || 0}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Completion Rate"
                  value={getCompletionRate()}
                  suffix="%"
                  valueStyle={{ 
                    color: getCompletionRate() > 80 ? '#52c41a' : getCompletionRate() > 60 ? '#faad14' : '#13c2c2'
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Avg Resolution Time"
                  value={getAverageResolutionTime()}
                  suffix=" days"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Efficiency Score"
                  value={getEfficiencyScore()}
                  suffix="/100"
                  valueStyle={{ 
                    color: getEfficiencyScore() > 80 ? '#52c41a' : getEfficiencyScore() > 60 ? '#faad14' : '#13c2c2'
                  }}
                />
              </Col>
            </Row>
            
            <Row style={{ marginTop: 24 }}>
              <Col span={24}>
                <Text strong>Workflow Performance</Text>
                <Progress 
                  percent={getEfficiencyScore()} 
                  strokeColor={getStepColor(Math.floor(getEfficiencyScore() / 20))}
                  format={(percent) => `${percent}% Efficient`}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={16}>
          <Card title="Workflow Stages">
            <Steps current={activeStep} direction="vertical" size="small">
              <Step 
                title="Submitted" 
                icon={getWorkflowIcon('pending')}
                status={workflowData?.pending > 0 ? 'finish' : 'wait'}
                description={`${workflowData?.pending || 0} complaints pending`}
              />
              <Step 
                title="In Review" 
                icon={getWorkflowIcon('under_review')}
                status={workflowData?.underReview > 0 ? 'finish' : 'wait'}
                description={`${workflowData?.underReview || 0} complaints under review`}
              />
              <Step 
                title="In Progress" 
                icon={getWorkflowIcon('in_progress')}
                status={workflowData?.inProgress > 0 ? 'finish' : 'wait'}
                description={`${workflowData?.inProgress || 0} complaints in progress`}
              />
              <Step 
                title="Resolved" 
                icon={getWorkflowIcon('resolved')}
                status={workflowData?.resolved > 0 ? 'finish' : 'wait'}
                description={`${workflowData?.resolved || 0} complaints resolved`}
              />
              <Step 
                title="Closed" 
                icon={getWorkflowIcon('closed')}
                status={workflowData?.closed > 0 ? 'finish' : 'wait'}
                description={`${workflowData?.closed || 0} complaints closed`}
              />
              <Step 
                title="Rejected" 
                icon={getWorkflowIcon('rejected')}
                status={workflowData?.rejected > 0 ? 'finish' : 'wait'}
                description={`${workflowData?.rejected || 0} complaints rejected`}
              />
            </Steps>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Recent Activity">
            <Timeline
              mode="left"
              items={[
                {
                  color: '#1890ff',
                  dot: <FileTextOutlined />,
                  children: (
                    <div>
                      <Text strong>New Complaint Submitted</Text>
                      <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        {workflowData?.recentActivity?.latestComplaint?.title}
                      </Text>
                    </div>
                  )
                },
                {
                  color: '#52c41a',
                  dot: <ClockCircleOutlined />,
                  children: (
                    <div>
                      <Text strong>Status Updated</Text>
                      <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        {workflowData?.recentActivity?.latestUpdate?.complaintTitle}
                        <Tag color={getStepColor(workflowData?.recentActivity?.latestUpdate?.newStatus)}>
                          {workflowData?.recentActivity?.latestUpdate?.newStatus}
                        </Tag>
                      </Text>
                    </div>
                  )
                },
                {
                  color: '#52c41a',
                  dot: <CheckCircleOutlined />,
                  children: (
                    <div>
                      <Text strong>Complaint Resolved</Text>
                      <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        {workflowData?.recentActivity?.latestResolved?.complaintTitle}
                      </Text>
                    </div>
                  )
                }
              ].reverse()}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="Quick Actions">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                icon={<UserOutlined />}
                size="large"
                style={{ width: '100%', marginBottom: 8 }}
              >
                Manage Users
              </Button>
              <Button 
                type="default" 
                icon={<FileTextOutlined />}
                size="large"
                style={{ width: '100%', marginBottom: 8 }}
              >
                View All Complaints
              </Button>
              <Button 
                type="dashed" 
                icon={<BellOutlined />}
                size="large"
                style={{ width: '100%', marginBottom: 8 }}
              >
                Notifications
                </Button>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="System Performance">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic
                  title="Response Rate"
                  value={workflowData?.responseRate || 0}
                  suffix="/hr"
                  prefix={<SafetyOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Resolution Rate"
                  value={workflowData?.resolutionRate || 0}
                  suffix="/day"
                  prefix={<TrophyOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
            <Row style={{ marginTop: 16 }}>
              <Col span={24}>
                <Text>
                  <Text strong>System Health:</Text>
                  <Tag 
                    color={getEfficiencyScore() > 80 ? '#52c41a' : getEfficiencyScore() > 60 ? '#faad14' : '#13c2c2'}
                    style={{ marginLeft: 8 }}
                  >
                    {getEfficiencyScore() > 80 ? 'Excellent' : getEfficiencyScore() > 60 ? 'Good' : 'Needs Improvement'}
                  </Tag>
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminWorkflow;
