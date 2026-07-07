import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Progress, Button, List, Space, Typography, Tag, Divider, Empty, message, Spin, Avatar
} from 'antd';
import {
  UserOutlined,
  LaptopOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { LeaveBalance, Attendance, Task, Asset } from '../../types';

const { Title, Text, Paragraph } = Typography;

export const ESSDashboard: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myAssets, setMyAssets] = useState<Asset[]>([]);
  const [checkingInOut, setCheckingInOut] = useState<boolean>(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [balances, attendance, tasks, assets] = await Promise.all([
        api.getLeaveBalances(user.id),
        api.getAttendanceToday(),
        api.getTasks({ assigneeId: user.id, status: 'Pending' }),
        api.getAssets()
      ]);
      
      setLeaveBalances(balances);
      setTodayAttendance(attendance);
      setMyTasks(tasks);
      setMyAssets(assets);
    } catch (err) {
      console.error('Error loading ESS data:', err);
      message.error('Failed to load self service data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle Dynamic Check-In
  const handleCheckIn = async () => {
    setCheckingInOut(true);
    try {
      const att = await api.checkIn({ remarks: 'Self check-in via ESS Portal' });
      setTodayAttendance(att);
      message.success('Checked in successfully.');
    } catch (err) {
      console.error('Check-in error:', err);
      message.error('Failed to check-in.');
    } finally {
      setCheckingInOut(false);
    }
  };

  // Handle Dynamic Check-Out
  const handleCheckOut = async () => {
    setCheckingInOut(true);
    try {
      const att = await api.checkOut();
      setTodayAttendance(att);
      message.success('Checked out successfully.');
    } catch (err) {
      console.error('Check-out error:', err);
      message.error('Failed to check-out.');
    } finally {
      setCheckingInOut(false);
    }
  };

  // Calculate Profile Completion Score
  const calculateProfileCompletion = () => {
    if (!user) return 0;
    let score = 50;
    if (user.phone) score += 10;
    if (user.address) score += 10;
    if (user.bio) score += 10;
    if (user.avatar_url) score += 10;
    if ((user as any).skills && (user as any).skills.length > 0) score += 10;
    return score;
  };

  const getIncompleteFields = () => {
    const list = [];
    if (!user) return [];
    if (!user.phone) list.push('Phone number');
    if (!user.address) list.push('Address details');
    if (!user.bio) list.push('Bio description');
    if (!user.avatar_url) list.push('Profile picture');
    if (!(user as any).skills || (user as any).skills.length === 0) list.push('Skills declarations');
    return list;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const completionScore = calculateProfileCompletion();
  const incompleteList = getIncompleteFields();

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Welcome Section */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0, fontWeight: 600 }}>Welcome Back, {user?.first_name}!</Title>
          <Text type="secondary">Here is a summary of your workspace, assets, and schedule for today.</Text>
        </Col>
        <Col>
          <Tag color="success" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>
            Status: {user?.status}
          </Tag>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* LEFT COLUMN: Profile info & Completion Progress */}
        <Col xs={24} lg={8}>
          {/* Profile Card */}
          <Card style={{ borderRadius: 12, marginBottom: 24, textAlign: 'center' }}>
            <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: 'var(--primary-color)', marginBottom: 16 }} />
            <Title level={4} style={{ margin: 0 }}>{user?.first_name} {user?.last_name}</Title>
            <Text type="secondary">{user?.role} • {user?.department?.name || 'General Operations'}</Text>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ textAlign: 'left' }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Email Address</Text>
                  <Text strong>{user?.email}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Bio Summary</Text>
                  <Text>{user?.bio || 'No bio summary added yet.'}</Text>
                </div>
              </Space>
            </div>
          </Card>

          {/* Profile Completion Gauge */}
          <Card title="Profile Completion Score" style={{ borderRadius: 12 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Progress type="circle" percent={completionScore} />
            </div>
            {incompleteList.length > 0 ? (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                  <ExclamationCircleOutlined style={{ color: 'var(--warning-color)', marginRight: 6 }} />
                  Pending details to hit 100%:
                </Text>
                <List
                  dataSource={incompleteList}
                  size="small"
                  renderItem={item => <List.Item style={{ padding: '4px 0', border: 'none', color: '#64748B' }}>• {item}</List.Item>}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--success-color)' }}>
                <CheckCircleOutlined style={{ fontSize: 18, marginRight: 6 }} />
                <Text strong style={{ color: 'var(--success-color)' }}>Your profile is fully complete!</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* RIGHT COLUMN: Interactive Widgets Grid */}
        <Col xs={24} lg={16}>
          {/* Quick Stats Panel */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Clock-In Panel */}
            <Col xs={24} md={12}>
              <Card style={{ borderRadius: 12, height: '100%' }} bodyStyle={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>Daily Shift Attendance</Text>
                  {todayAttendance?.check_in ? (
                    <div>
                      <Tag color="success">Checked In</Tag>
                      <div style={{ marginTop: 12 }}>
                        <Text type="secondary" style={{ display: 'block' }}>In Time:</Text>
                        <Text strong>{new Date(todayAttendance.check_in).toLocaleTimeString()}</Text>
                      </div>
                      {todayAttendance.check_out && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ display: 'block' }}>Out Time:</Text>
                          <Text strong>{new Date(todayAttendance.check_out).toLocaleTimeString()}</Text>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Tag color="default">Not Checked In</Tag>
                      <Paragraph type="secondary" style={{ marginTop: 8 }}>Start your work timer for today's logs.</Paragraph>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 20 }}>
                  {!todayAttendance?.check_in ? (
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      block
                      loading={checkingInOut}
                      onClick={handleCheckIn}
                    >
                      Check In Now
                    </Button>
                  ) : !todayAttendance?.check_out ? (
                    <Button
                      danger
                      icon={<LogoutOutlined />}
                      block
                      loading={checkingInOut}
                      onClick={handleCheckOut}
                    >
                      Check Out
                    </Button>
                  ) : (
                    <Button disabled block>Shift Completed</Button>
                  )}
                </div>
              </Card>
            </Col>

            {/* Leave Balance Widget */}
            <Col xs={24} md={12}>
              <Card style={{ borderRadius: 12, height: '100%' }}>
                <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>Leave Balances</Text>
                {leaveBalances.length > 0 ? (
                  <Row gutter={[8, 8]}>
                    {leaveBalances.map(bal => (
                      <Col span={12} key={bal.leave_type_id}>
                        <div style={{ border: '1px solid #E4E7EC', padding: '10px 14px', borderRadius: 8, textAlign: 'center' }}>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{bal.leave_type?.name || 'Leave'}</Text>
                          <Text strong style={{ fontSize: 16, color: 'var(--success-color)' }}>{bal.remaining_days} / {bal.total_days} days</Text>
                        </div>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Empty description="No leave balance limits allocated." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Assigned Assets & Tasks */}
          <Row gutter={[24, 24]}>
            {/* Assigned Assets */}
            <Col xs={24} md={12}>
              <Card title="My Allocated Assets" style={{ borderRadius: 12, height: '100%' }} extra={<LaptopOutlined style={{ color: 'var(--primary-color)' }} />}>
                <List
                  dataSource={myAssets}
                  locale={{ emptyText: 'No assets currently allocated to your profile.' }}
                  renderItem={asset => (
                    <List.Item style={{ padding: '12px 0' }}>
                      <List.Item.Meta
                        title={<Text strong>{asset.asset_name}</Text>}
                        description={
                          <Space direction="vertical" size={2}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Tag: {asset.serial_number || 'N/A'} • Type: {asset.asset_type}</Text>
                            <Tag color="success">Condition: {asset.asset_condition}</Tag>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            {/* My Active Tasks */}
            <Col xs={24} md={12}>
              <Card title="My Pending Assignments" style={{ borderRadius: 12, height: '100%' }} extra={<FolderOpenOutlined style={{ color: 'var(--primary-color)' }} />}>
                <List
                  dataSource={myTasks}
                  locale={{ emptyText: 'No pending tasks assigned to you.' }}
                  renderItem={task => (
                    <List.Item style={{ padding: '12px 0' }}>
                      <List.Item.Meta
                        title={<Text strong>{task.title}</Text>}
                        description={
                          <Space>
                            <Tag color={task.priority === 'High' ? 'error' : task.priority === 'Medium' ? 'warning' : 'blue'}>
                              {task.priority} Priority
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>

          {/* Simulated Payslips Card */}
          <Card title="My Payslips & Compensation Summary" style={{ borderRadius: 12, marginTop: 24 }} extra={<FileTextOutlined style={{ color: 'var(--primary-color)' }} />}>
            <List
              dataSource={[
                { cycle: 'May 2026', desc: 'Monthly Salary Compensation Rollout', file: 'payslip_2026_05.pdf' },
                { cycle: 'April 2026', desc: 'Monthly Salary Compensation Rollout', file: 'payslip_2026_04.pdf' }
              ]}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button type="link" onClick={() => message.success(`Downloading simulated ${item.file}...`)}>
                      Download PDF
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong>{item.cycle}</Text>}
                    description={item.desc}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ESSDashboard;
