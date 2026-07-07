import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Progress, Table, Tag, Button, Modal, Form,
  Input, Checkbox, Select, Space, Typography, Upload, message, Empty, Tabs
} from 'antd';
import {
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  InboxOutlined,
  UserOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { api, SERVER_URL } from '../../services/api';
import { OnboardingTask, OnboardingProgress, Employee, Department } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const OnboardingWorkspace: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'HR';
  const isManager = user?.role === 'Manager';
  const canManageTasks = isAdminOrHR;

  // Selected Employee for onboarding details
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(user?.id || null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [progressList, setProgressList] = useState<OnboardingProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskForm] = Form.useForm();
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null);

  // Load basic reference data (employees & depts for selection)
  const loadReferenceData = async () => {
    try {
      const deptsRes = await api.getDepartments();
      setDepartments(deptsRes);

      if (isAdminOrHR || isManager) {
        const empsRes = await api.getEmployees({ limit: 1000 });
        setEmployees(empsRes.data || []);
      }
    } catch (err) {
      console.error('Error loading reference data:', err);
    }
  };

  // Load progress and task templates
  const loadOnboardingData = async () => {
    if (!selectedEmpId) return;
    setLoading(true);
    try {
      const progressRes = await api.getEmployeeOnboarding(selectedEmpId);
      setProgressList(progressRes);
    } catch (err) {
      console.error('Error loading onboarding progress:', err);
      message.error('Failed to load onboarding checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadOnboardingData();
  }, [selectedEmpId]);

  // Handle task creation
  const handleCreateTask = async (values: any) => {
    try {
      await api.createOnboardingTask(values);
      message.success('Onboarding task created and assigned to candidates on probation.');
      setIsTaskModalOpen(false);
      taskForm.resetFields();
      loadOnboardingData();
    } catch (err) {
      console.error('Error creating onboarding task:', err);
      message.error('Failed to create onboarding task.');
    }
  };

  // Custom File Upload Handler
  const handleUpload = async (taskId: number, file: File) => {
    if (!selectedEmpId) return;
    setUploadingTaskId(taskId);
    try {
      const doc = await api.uploadDocument(selectedEmpId, file);
      // Construct file path to update onboarding progress status
      await api.updateOnboardingProgress({
        employee_id: selectedEmpId,
        taskId,
        status: 'Completed',
        documentUrl: doc.file_path,
        verifiedBy: null
      });
      message.success('Document uploaded and onboarding task submitted for verification.');
      loadOnboardingData();
    } catch (err) {
      console.error('Error uploading file:', err);
      message.error('Failed to upload document proof.');
    } finally {
      setUploadingTaskId(null);
    }
  };

  // Verify task completion (For HR/Admin/Manager)
  const handleVerifyTask = async (taskId: number) => {
    if (!selectedEmpId) return;
    try {
      await api.updateOnboardingProgress({
        employee_id: selectedEmpId,
        taskId,
        status: 'Completed',
        verifiedBy: user?.id
      });
      message.success('Task verified successfully.');
      loadOnboardingData();
    } catch (err) {
      console.error('Error verifying onboarding task:', err);
      message.error('Failed to verify onboarding task.');
    }
  };

  // Skip or manually complete task
  const handleUpdateStatus = async (taskId: number, newStatus: OnboardingProgress['status']) => {
    if (!selectedEmpId) return;
    try {
      await api.updateOnboardingProgress({
        employee_id: selectedEmpId,
        taskId,
        status: newStatus,
        verifiedBy: isAdminOrHR ? user?.id : null
      });
      message.success(`Task status updated to ${newStatus}.`);
      loadOnboardingData();
    } catch (err) {
      console.error('Error updating task status:', err);
      message.error('Failed to update task status.');
    }
  };

  // Calculate metrics
  const totalTasks = progressList.length;
  const completedTasks = progressList.filter(p => p.status === 'Completed' && p.verified_by).length;
  const submittedTasks = progressList.filter(p => p.status === 'Completed' && !p.verified_by).length;
  const pendingTasks = totalTasks - completedTasks - submittedTasks;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Selected Employee Info
  const selectedEmployee = employees.find(e => e.id === selectedEmpId) || (selectedEmpId === user?.id ? user : null);

  const getTaskBadge = (task: OnboardingTask) => {
    if (task.is_document_upload) return <Tag color="blue">Document Upload</Tag>;
    if (task.is_asset_allocation) return <Tag color="purple">Asset Allocation</Tag>;
    if (task.is_training_assignment) return <Tag color="orange">Training Module</Tag>;
    return <Tag color="default">General</Tag>;
  };

  const renderTaskCard = (progress: OnboardingProgress) => {
    const task = progress.task;
    if (!task) return null;

    const isSelf = user?.id === selectedEmpId;
    const isCompleted = progress.status === 'Completed';
    const isVerified = !!progress.verified_by;
    const needsVerification = isCompleted && !isVerified;

    return (
      <Card
        key={progress.id}
        hoverable
        style={{ marginBottom: 16, borderRadius: 12, borderLeft: `5px solid ${isVerified ? 'var(--success-color)' : needsVerification ? 'var(--primary-color)' : '#94A3B8'}` }}
        bodyStyle={{ padding: 20 }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space direction="vertical" size={4}>
              <Space>
                <Text strong style={{ fontSize: 16 }}>{task.title}</Text>
                {getTaskBadge(task)}
                {isVerified ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
                ) : needsVerification ? (
                  <Tag icon={<ClockCircleOutlined />} color="processing">Pending Verification</Tag>
                ) : progress.status === 'In Progress' ? (
                  <Tag color="warning">In Progress</Tag>
                ) : (
                  <Tag color="default">Pending</Tag>
                )}
              </Space>
              <Paragraph type="secondary" style={{ marginBottom: 8 }}>{task.description}</Paragraph>
              {progress.document_url && (
                <div>
                  <Space>
                    <FileTextOutlined style={{ color: 'var(--success-color)' }} />
                    <a href={`${SERVER_URL}/${progress.document_url}`} target="_blank" rel="noopener noreferrer">
                      View Submitted Proof
                    </a>
                  </Space>
                </div>
              )}
              {isVerified && progress.verified_by && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Verified by: {employees.find(e => e.id === progress.verified_by)?.first_name || 'HR Team'}
                </Text>
              )}
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space size={8}>
              {/* Employee Actions */}
              {isSelf && !isCompleted && (
                <>
                  {task.is_document_upload ? (
                    <Upload
                      beforeUpload={(file) => {
                        handleUpload(task.id, file);
                        return false;
                      }}
                      showUploadList={false}
                    >
                      <Button type="primary" icon={<InboxOutlined />} loading={uploadingTaskId === task.id}>
                        Upload Document
                      </Button>
                    </Upload>
                  ) : (
                    <Button type="primary" onClick={() => handleUpdateStatus(task.id, 'Completed')}>
                      Mark Completed
                    </Button>
                  )}
                  {progress.status !== 'In Progress' && (
                    <Button onClick={() => handleUpdateStatus(task.id, 'In Progress')}>
                      In Progress
                    </Button>
                  )}
                </>
              )}

              {/* HR / Admin / Manager Actions */}
              {(isAdminOrHR || isManager) && (
                <>
                  {needsVerification && (
                    <Button
                      type="primary"
                      icon={<SafetyCertificateOutlined />}
                      onClick={() => handleVerifyTask(task.id)}
                    >
                      Verify Task
                    </Button>
                  )}
                  {!isVerified && (
                    <Button danger onClick={() => handleUpdateStatus(task.id, 'Pending')}>
                      Reset Pending
                    </Button>
                  )}
                </>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0, fontWeight: 600 }}>Employee Onboarding Checklist</Title>
          <Text type="secondary">Follow and verify complete employee induction pipelines</Text>
        </Col>
        <Col>
          <Space>
            {canManageTasks && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsTaskModalOpen(true)}
              >
                Create Task Template
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Selector Row for Admins / Managers */}
      {(isAdminOrHR || isManager) && (
        <Card style={{ marginBottom: 24, borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
          <Space size={16}>
            <Text strong>Select Employee to View Checklist:</Text>
            <Select
              showSearch
              placeholder="Search employee..."
              style={{ width: 300 }}
              value={selectedEmpId}
              onChange={(value) => setSelectedEmpId(value)}
              filterOption={(input, option) =>
                (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {employees.map(emp => (
                <Option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.role} - {emp.status})
                </Option>
              ))}
            </Select>
          </Space>
        </Card>
      )}

      {/* Checklist Stats */}
      {selectedEmpId ? (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card style={{ borderRadius: 12, textAlign: 'center' }} title="Onboarding Progress Indicator">
              <Progress type="circle" percent={completionPercentage} />
              <div style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Text type="secondary" style={{ display: 'block' }}>Pending</Text>
                    <Text strong style={{ fontSize: 20 }}>{pendingTasks}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ display: 'block' }}>Submitted</Text>
                    <Text strong style={{ fontSize: 20, color: 'var(--primary-color)' }}>{submittedTasks}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ display: 'block' }}>Verified</Text>
                    <Text strong style={{ fontSize: 20, color: 'var(--success-color)' }}>{completedTasks}</Text>
                  </Col>
                </Row>
              </div>

              {selectedEmployee && (
                <Card style={{ marginTop: 24, backgroundColor: '#F7F8FA', border: 'none' }} bodyStyle={{ padding: 16 }}>
                  <Space direction="vertical" align="center" style={{ width: '100%' }}>
                    <UserOutlined style={{ fontSize: 32, color: '#64748B' }} />
                    <div>
                      <Text strong style={{ display: 'block' }}>
                        {selectedEmployee.first_name} {selectedEmployee.last_name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectedEmployee.email}
                      </Text>
                    </div>
                    <Tag color={selectedEmployee.status === 'Active' ? 'success' : 'warning'}>
                      Status: {selectedEmployee.status}
                    </Tag>
                  </Space>
                </Card>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card style={{ borderRadius: 12 }}>
              <Tabs defaultActiveKey="all" items={[
                {
                  key: 'all',
                  label: `All Tasks (${totalTasks})`,
                  children: (
                    loading ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading checklist...</div>
                    ) : progressList.length === 0 ? (
                      <Empty description="No onboarding tasks assigned to this employee." />
                    ) : (
                      progressList.map(renderTaskCard)
                    )
                  )
                },
                {
                  key: 'pending',
                  label: `Pending / Verification (${pendingTasks + submittedTasks})`,
                  children: (
                    loading ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading checklist...</div>
                    ) : progressList.filter(p => !p.verified_by).length === 0 ? (
                      <Empty description="No pending tasks!" />
                    ) : (
                      progressList.filter(p => !p.verified_by).map(renderTaskCard)
                    )
                  )
                },
                {
                  key: 'completed',
                  label: `Verified Completed (${completedTasks})`,
                  children: (
                    loading ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading checklist...</div>
                    ) : progressList.filter(p => p.verified_by).length === 0 ? (
                      <Empty description="No verified completed tasks." />
                    ) : (
                      progressList.filter(p => p.verified_by).map(renderTaskCard)
                    )
                  )
                }
              ]} />
            </Card>
          </Col>
        </Row>
      ) : (
        <Card style={{ borderRadius: 12 }}>
          <Empty description="Please select an employee to view onboarding checklist details." />
        </Card>
      )}

      {/* Task Creation Modal */}
      <Modal
        title="Create Onboarding Task Template"
        open={isTaskModalOpen}
        onCancel={() => setIsTaskModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={taskForm} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item
            name="title"
            label="Task Title"
            rules={[{ required: true, message: 'Please input the task title!' }]}
          >
            <Input placeholder="e.g. Upload signed contract" />
          </Form.Item>

          <Form.Item name="description" label="Task Description">
            <TextArea rows={3} placeholder="Provide details about the onboarding assignment..." />
          </Form.Item>

          <Form.Item name="role_restriction" label="Role Restriction (Optional)">
            <Select placeholder="All Roles" allowClear>
              <Option value="Employee">Employee Only</Option>
              <Option value="Manager">Manager Only</Option>
              <Option value="HR">HR Only</Option>
            </Select>
          </Form.Item>

          <Form.Item name="department_id" label="Department Restriction (Optional)">
            <Select placeholder="All Departments" allowClear>
              {departments.map(d => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="is_document_upload" valuePropName="checked">
                <Checkbox>Doc Upload</Checkbox>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_asset_allocation" valuePropName="checked">
                <Checkbox>Asset Alloc</Checkbox>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_training_assignment" valuePropName="checked">
                <Checkbox>Training Task</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save Template
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OnboardingWorkspace;
