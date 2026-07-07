import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Space, Alert, Typography, Divider, Tabs, Table, Checkbox, Button, message, Spin } from 'antd';
import { 
  SafetyCertificateOutlined, 
  DatabaseOutlined,
  CheckCircleOutlined,
  LockOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Permission } from '../types';

const { Text } = Typography;

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('session');
  
  // Permissions Matrix States
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, number[]>>({}); // role -> permissionIds
  
  const roles = ['HR', 'Manager', 'Employee', 'Intern'];
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';

  const fetchPermissionsData = async () => {
    setLoading(true);
    try {
      const perms = await api.getPermissions();
      setPermissions(perms);
      
      const roleMap: Record<string, number[]> = {};
      
      // Fetch each role's current permissions
      await Promise.all(
        roles.map(async (role) => {
          const names = await api.getRolePermissions(role);
          // Map names to IDs
          const ids = perms
            .filter(p => names.includes(p.code))
            .map(p => p.id);
          roleMap[role] = ids;
        })
      );
      
      setMatrix(roleMap);
    } catch (err) {
      console.error('Error fetching permission matrix:', err);
      message.error('Failed to load system permissions matrix.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'matrix') {
      fetchPermissionsData();
    }
  }, [activeTab]);

  const handleCheckboxChange = (role: string, permissionId: number, checked: boolean) => {
    if (!isAdmin) return;
    
    setMatrix(prev => {
      const currentIds = prev[role] || [];
      const updatedIds = checked
        ? [...currentIds, permissionId]
        : currentIds.filter(id => id !== permissionId);
      
      return {
        ...prev,
        [role]: updatedIds
      };
    });
  };

  const handleSaveMatrix = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await Promise.all(
        roles.map(async (role) => {
          await api.assignRolePermissions(role, matrix[role] || []);
        })
      );
      message.success('System permissions matrix updated successfully.');
      fetchPermissionsData();
    } catch (err) {
      console.error('Error saving matrix:', err);
      message.error('Failed to save permissions matrix.');
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  // Matrix Table Columns
  const columns = [
    {
      title: 'System Capability',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
      render: (text: string, record: Permission) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>
            {record.name}
          </Text>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{record.description}</div>
        </div>
      )
    },
    // Read only Super Admin
    {
      title: 'Super Admin',
      key: 'Super Admin',
      align: 'center' as const,
      render: () => <Checkbox checked disabled />
    },
    // Read only Admin
    {
      title: 'Admin',
      key: 'Admin',
      align: 'center' as const,
      render: () => <Checkbox checked disabled />
    },
    // Editable Roles
    ...roles.map(role => ({
      title: role,
      key: role,
      align: 'center' as const,
      render: (_: any, record: Permission) => {
        const checked = (matrix[role] || []).includes(record.id);
        return (
          <Checkbox
            checked={checked}
            disabled={!isAdmin || saving}
            onChange={(e) => handleCheckboxChange(role, record.id, e.target.checked)}
          />
        );
      }
    }))
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', width: '100%' }}>
      {/* HEADER SECTION */}
      <div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 600, 
          letterSpacing: '-0.03em', 
          color: '#000000',
          marginBottom: '4px'
        }}>
          System Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Configure enterprise settings, view authorization policies, and check system environment health.
        </p>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="line" size="large">
        <Tabs.TabPane 
          tab={<Space><SafetyCertificateOutlined /><span>Session & Roles</span></Space>} 
          key="session"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
            {/* SECURITY PROFILE CARD */}
            <Card title={<Space><SafetyCertificateOutlined /><span>User Session & Role Authorization</span></Space>}>
              <Descriptions column={1} bordered size="middle">
                <Descriptions.Item label="Authorized User">
                  {user ? `${user.first_name} ${user.last_name}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Registered Email">
                  {user?.email}
                </Descriptions.Item>
                <Descriptions.Item label="Designation">
                  {user?.designation}
                </Descriptions.Item>
                <Descriptions.Item label="Authorized Role">
                  <Tag color={
                    user?.role === 'Super Admin' ? 'purple' :
                    user?.role === 'Admin' ? 'red' :
                    user?.role === 'HR' ? 'magenta' :
                    user?.role === 'Manager' ? 'orange' :
                    user?.role === 'Employee' ? 'blue' : 'green'
                  }>
                    {user?.role} Access
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Session Timeout">
                  24 Hours (JWT Token Expiry)
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<Space><LockOutlined /><span>Permissions Matrix</span></Space>} 
          key="matrix"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
            {!isAdmin && (
              <Alert
                message="Read-Only Policy View"
                description="You are currently viewing the system capability matrix. Only Super Admins and Admins can modify the security permission matrix."
                type="info"
                showIcon
              />
            )}

            {isAdmin && (
              <Alert
                message="Granular Security Console"
                description="Modify the capability matrix to assign permissions to organizational roles. Super Admin and Admin roles bypass checks and always hold full capabilities."
                type="warning"
                showIcon
              />
            )}

            <Card 
              title="Role-Based Access Control (RBAC) Matrix"
              extra={
                isAdmin && (
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    onClick={handleSaveMatrix} 
                    loading={saving}
                  >
                    Save Policy Matrix
                  </Button>
                )
              }
            >
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <Spin tip="Loading permissions matrix..." size="large" />
                </div>
              ) : (
                <Table
                  dataSource={permissions}
                  columns={columns}
                  rowKey="id"
                  pagination={false}
                  bordered
                  size="middle"
                  style={{ overflowX: 'auto' }}
                />
              )}
            </Card>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<Space><DatabaseOutlined /><span>System Health</span></Space>} 
          key="health"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
            {/* DATABASE & SYSTEM ENVIRONMENT CARD */}
            <Card title={<Space><DatabaseOutlined /><span>System Architecture Health</span></Space>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Alert
                  message="Dual-Mode Database Core Enabled"
                  description="The HRMS backend is running with automatic database selection. If PostgreSQL becomes offline, the system self-heals by running operations on database.json. Connection parameters are managed dynamically in .env configurations."
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined style={{ color: 'var(--success-color)' }} />}
                  style={{ borderRadius: '6px' }}
                />

                <Divider style={{ margin: '12px 0' }} />

                <Descriptions column={1} size="small">
                  <Descriptions.Item label={<Text strong>API Port</Text>}>
                    <code>5000</code>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text strong>Database Storage Mode</Text>}>
                    <Tag color="cyan">Fallback JSON Core / PostgreSQL Ready</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text strong>Local Storage Endpoint</Text>}>
                    <code>/backend/database.json</code>
                  </Descriptions.Item>
                  <Descriptions.Item label={<Text strong>Encryption Core</Text>}>
                    <code>BcryptJS (10 Rounds salt)</code>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </Card>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default Settings;
