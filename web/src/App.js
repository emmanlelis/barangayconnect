import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu, Typography, App as AntApp, Button } from 'antd';
import { DashboardOutlined, FileTextOutlined, UserOutlined, BellOutlined, MailOutlined, CalendarOutlined } from '@ant-design/icons';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Notifications from './components/Notifications';
import UserManagement from './components/UserManagement';
import ManualComplaint from './components/ManualComplaint';
import BlotterManagement from './components/BlotterManagement';
import Documents from './components/Documents';
import MailSettings from './components/MailSettings';
import CalendarSchedule from './components/CalendarSchedule';
import AdminUserManagement from './components/AdminUserManagement';

const { Content, Sider } = Layout;
const { Title } = Typography;

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [openKeys, setOpenKeys] = useState(['blotter-management']);

  // Determine which menu items should be open based on current pathname
  useEffect(() => {
    const path = window.location.pathname;
    const keysToOpen = [];

    if (path.startsWith('/blotters')) {
      keysToOpen.push('blotter-management');
      
      if (path.startsWith('/blotters/ongoing')) {
        keysToOpen.push('/blotters/ongoing');
      } else if (path.startsWith('/blotters/closed')) {
        keysToOpen.push('/blotters/closed');
      }
    }

    if (keysToOpen.length > 0) {
      setOpenKeys(keysToOpen);
    }
  }, [window.location.pathname]);

  if (isLoading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div>Loading...</div>
        </Content>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <AntApp>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          theme="dark"
          style={{ height: '100%', borderRight: 0 }}
        >
          <div style={{ padding: '18px 16px 14px', display: 'flex', justifyContent: 'center' }}>
            <img
              src="/barangayconnect-logo.png"
              alt="BarangayConnect"
              style={{ width: '100%', maxWidth: 170, height: 'auto', display: 'block' }}
            />
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            openKeys={openKeys}
            onOpenChange={setOpenKeys}
            items={[
              {
                key: '/',
                icon: <DashboardOutlined />,
                label: 'Dashboard',
              },
              {
                key: '/manual-blotter',
                icon: <FileTextOutlined />,
                label: 'Log a Manual Blotter',
              },
              {
                key: 'blotter-management',
                icon: <FileTextOutlined />,
                label: 'Blotter Management',
                children: [
                  {
                    key: '/blotters',
                    label: 'All Blotters',
                  },
                  {
                    key: '/blotters/new',
                    label: 'New App Blotters',
                  },
                  {
                    key: '/blotters/anonymous',
                    label: 'Anonymous Blotters',
                  },
                  {
                    key: '/blotters/ongoing',
                    label: 'Ongoing Blotters',
                    children: [
                      {
                        key: '/blotters/ongoing/no-mediation',
                        label: 'New/No Mediation Needed Blotters',
                      },
                      {
                        key: '/blotters/ongoing/new',
                        label: 'New/1st Mediation Blotters',
                      },
                      {
                        key: '/blotters/ongoing/2nd-mediation',
                        label: 'Ongoing for 2nd Mediation Blotters',
                      },
                      {
                        key: '/blotters/ongoing/3rd-mediation',
                        label: 'Ongoing for 3rd Mediation Blotters',
                      },
                    ],
                  },
                  {
                    key: '/blotters/closed',
                    label: 'Closed Blotters',
                    children: [
                      {
                        key: '/blotters/closed/no-show',
                        label: 'No Show Blotters',
                      },
                      {
                        key: '/blotters/closed/resolved',
                        label: 'Resolved Blotters',
                      },
                      {
                        key: '/blotters/closed/certificate-action',
                        label: 'Certificate to File Action',
                      },
                    ],
                  },
                  {
                    key: '/blotters/lupon',
                    label: 'Lupon ng Tagapamayapa',
                  },
                  {
                    key: '/blotters/recently-deleted',
                    label: 'Recently Deleted Blotters',
                  },
                ],
              },
              {
                key: '/user-management',
                icon: <UserOutlined />,
                label: 'User Management',
              },
              {
                key: '/calendar-schedule',
                icon: <CalendarOutlined />,
                label: 'Calendar Schedule',
              },
              {
                key: '/documents',
                icon: <FileTextOutlined />,
                label: 'Documents',
              },
              {
                key: '/mail-settings',
                icon: <MailOutlined />,
                label: 'Mail Settings',
              },
              {
                key: '/admin-user-management',
                icon: <UserOutlined />,
                label: 'Admin User Management',
              },
            ]}
            onClick={({ key }) => {
              window.location.pathname = key;
            }}
          />
        </Sider>
        <Layout>
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/blotters" element={<BlotterManagement filterType="all" />} />
            <Route path="/blotters/new" element={<BlotterManagement filterType="new" />} />
            <Route path="/blotters/anonymous" element={<BlotterManagement filterType="anonymous" />} />
            <Route path="/blotters/ongoing" element={<BlotterManagement filterType="ongoing" />} />
            <Route path="/blotters/ongoing/new" element={<BlotterManagement filterType="ongoing-new" />} />
            <Route path="/blotters/ongoing/no-mediation" element={<BlotterManagement filterType="ongoing-no-mediation" />} />
            <Route path="/blotters/ongoing/2nd-mediation" element={<BlotterManagement filterType="ongoing-2nd" />} />
            <Route path="/blotters/ongoing/3rd-mediation" element={<BlotterManagement filterType="ongoing-3rd" />} />
            <Route path="/blotters/closed" element={<BlotterManagement filterType="closed" />} />
            <Route path="/blotters/closed/no-show" element={<BlotterManagement filterType="no-show" />} />
            <Route path="/blotters/closed/resolved" element={<BlotterManagement filterType="resolved" />} />
            <Route path="/blotters/closed/certificate-action" element={<BlotterManagement filterType="certificate-action" />} />
            <Route path="/blotters/lupon" element={<BlotterManagement filterType="lupon" />} />
            <Route path="/blotters/recently-deleted" element={<BlotterManagement filterType="recently-deleted" />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/manual-blotter" element={<ManualComplaint />} />
            <Route path="/calendar-schedule" element={<CalendarSchedule />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/mail-settings" element={<MailSettings />} />
            <Route path="/admin-user-management" element={<AdminUserManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Layout>
    </AntApp>
  );
}

export default App;
