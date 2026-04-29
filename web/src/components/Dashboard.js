import React, { useState, useEffect } from 'react';
import { Layout, Typography, Row, Col, Card, Statistic, Table, Tag, message, Button } from 'antd';
import { 
  FileTextOutlined, 
  LogoutOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';
import moment from 'moment';

const { Header, Content } = Layout;
const { Title } = Typography;

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await adminAPI.getDashboard();
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const getStatusColor = (status) => {
    const colors = {
      'new': 'blue',
      'ongoing': 'orange',
      'ongoing-2nd': 'orange',
      'ongoing-3rd': 'orange',
      'no-show': 'red',
      'resolved': 'green',
      'certificate-action': 'purple',
      'lupon': 'cyan'
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

  const recentComplaintsColumns = [
    {
      title: 'Case Number',
      dataIndex: 'caseNumber',
      key: 'caseNumber',
      width: 120,
    },
    {
      title: 'Complainant',
      dataIndex: 'complainant',
      key: 'complainant',
      ellipsis: true,
    },
    {
      title: 'Respondent',
      dataIndex: 'respondent',
      key: 'respondent',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => moment(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/blotters/${record._id}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return <div>Loading...</div>;
  }

  const stats = dashboardData?.statistics || {};
  const recentComplaints = dashboardData?.recentComplaints || [];
  const complaintsByCategory = dashboardData?.complaintsByCategory || [];
  const complaintsByPriority = dashboardData?.complaintsByPriority || [];
  const monthlyTrends = (dashboardData?.monthlyTrends || []).map(trend => ({
    ...trend,
    _id: `${trend._id?.month}/${trend._id?.year}`
  }));

  const counterCards = [
    {
      key: 'total',
      title: 'Total Blotters',
      value: stats.totalComplaints || 0,
      icon: <FileTextOutlined />,
      to: '/blotters',
      theme: { background: '#eef4ff', border: '#c9d8ff', accent: '#2457d6' }
    },
    {
      key: 'new-app',
      title: 'New App Blotter Submission',
      value: stats.newAppBlotters || 0,
      icon: <FileTextOutlined />,
      to: '/blotters/new',
      theme: { background: '#fff4e5', border: '#ffd8a8', accent: '#d97706' }
    },
    {
      key: 'no-mediation',
      title: 'New/No Mediation Needed',
      value: stats.ongoingNoMediation || 0,
      icon: <CheckCircleOutlined />,
      to: '/blotters/ongoing/no-mediation',
      theme: { background: '#ecfeff', border: '#a5f3fc', accent: '#0891b2' }
    },
    {
      key: 'first-mediation',
      title: 'New/1st Mediation Blotters',
      value: stats.newOngoingBlotters || 0,
      icon: <ClockCircleOutlined />,
      to: '/blotters/ongoing/new',
      theme: { background: '#ecfdf3', border: '#bbf7d0', accent: '#15803d' }
    },
    {
      key: 'second-mediation',
      title: '2nd Mediation',
      value: stats.ongoing2ndMediation || 0,
      icon: <ExclamationCircleOutlined />,
      to: '/blotters/ongoing/2nd-mediation',
      theme: { background: '#fff7ed', border: '#fed7aa', accent: '#ea580c' }
    },
    {
      key: 'third-mediation',
      title: '3rd Mediation',
      value: stats.ongoing3rdMediation || 0,
      icon: <WarningOutlined />,
      to: '/blotters/ongoing/3rd-mediation',
      theme: { background: '#fdf4ff', border: '#f5d0fe', accent: '#c026d3' }
    },
    {
      key: 'no-show',
      title: 'No Show Blotters',
      value: stats.noShowBlotters || 0,
      icon: <ExclamationCircleOutlined />,
      to: '/blotters/closed/no-show',
      theme: { background: '#fff1f2', border: '#fecdd3', accent: '#be123c' }
    },
    {
      key: 'resolved',
      title: 'Resolved Blotters',
      value: stats.resolvedBlotters || 0,
      icon: <CheckCircleOutlined />,
      to: '/blotters/closed/resolved',
      theme: { background: '#ecfdf3', border: '#bbf7d0', accent: '#15803d' }
    },
    {
      key: 'certificate-action',
      title: 'Certificate to File',
      value: stats.certificateAction || 0,
      icon: <FileTextOutlined />,
      to: '/blotters/closed/certificate-action',
      theme: { background: '#f5f3ff', border: '#ddd6fe', accent: '#7c3aed' }
    },
    {
      key: 'lupon',
      title: 'Lupon ng Tagapamayapa',
      value: stats.luponBlotters || 0,
      icon: <BarChartOutlined />,
      to: '/blotters/lupon',
      theme: { background: '#fff7ed', border: '#fed7aa', accent: '#ea580c' }
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div className="user-info">
            <span>Welcome, {user?.firstName} {user?.lastName}</span>
            <Button 
              type="primary" 
              danger 
              onClick={handleLogout}
              icon={<LogoutOutlined />}
            >
              Logout
            </Button>
          </div>
        </div>
      </Header>
      
      <Layout style={{ padding: '0 24px 24px' }}>
        <Content style={{ padding: '24px', margin: 0, minHeight: 280, background: '#fff' }}>
            <div className="dashboard-header">
              <Title level={2}>Dashboard Overview</Title>
            </div>

            {/* Statistics Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              {counterCards.map((card) => (
                <Col xs={24} sm={12} md={6} key={card.key}>
                  <Card
                    hoverable
                    onClick={() => navigate(card.to)}
                    style={{
                      background: card.theme.background,
                      border: `1px solid ${card.theme.border}`,
                      borderRadius: 12,
                      cursor: 'pointer'
                    }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <Statistic
                      title={card.title}
                      value={card.value}
                      prefix={card.icon}
                      valueStyle={{ color: card.theme.accent }}
                    />
                    <div style={{ marginTop: 10, color: card.theme.accent, fontSize: 12, fontWeight: 600 }}>
                      View Section
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            {/* Charts */}
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} lg={12}>
                <Card title="Blotters by Status" className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={complaintsByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="_id" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#1890ff" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="Monthly Blotter Trends" className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="_id" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#52c41a" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            {/* Recent Blotters */}
            <Card title="Recent Blotters" style={{ marginBottom: '24px' }}>
              <Table
                columns={recentComplaintsColumns}
                dataSource={recentComplaints}
                rowKey="_id"
                pagination={false}
                scroll={{ x: 800 }}
              />
              {recentComplaints.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <Button type="primary" onClick={() => navigate('/blotters')}>
                    View All Blotters
                  </Button>
                </div>
              )}
            </Card>

            {/* Performance Metrics */}
            <Card title="Average Resolution Time">
              <Statistic
                title="Days to Resolution"
                value={stats.avgResolutionTime?.toFixed(1) || 0}
                suffix="days"
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Content>
        </Layout>
      </Layout>
    );
}

export default Dashboard;
