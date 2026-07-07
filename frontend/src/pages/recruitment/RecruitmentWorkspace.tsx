import React, { useState, useEffect } from 'react';
import { 
  Tabs, Card, Row, Col, Table, Button, Modal, Form, 
  Input, Select, DatePicker, Space, Tag, Empty, 
  message, Avatar, Typography, Rate, Timeline
} from 'antd';
import { 
  PlusOutlined, 
  UserOutlined, 
  CalendarOutlined,
  SolutionOutlined,
  FileTextOutlined,
  MessageOutlined,
  StarOutlined,
  PieChartOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { api, SERVER_URL } from '../../services/api';
import { Job, Candidate, Interview, InterviewFeedback, Employee, Department } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip } from 'recharts';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

const COLORS = ['#1E2A4A', '#F5A524', '#2DBE8C', '#E5484D', '#8B5CF6', '#14B8A6'];

export const RecruitmentWorkspace: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'HR';

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Data States
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Modal States
  const [isJobModalOpen, setIsJobModalOpen] = useState<boolean>(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [feedbacks, setFeedbacks] = useState<InterviewFeedback[]>([]);

  // Form Instances
  const [jobForm] = Form.useForm();
  const [interviewForm] = Form.useForm();
  const [feedbackForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsRes, candidatesRes, interviewsRes, deptsRes] = await Promise.all([
        api.getJobs(),
        api.getCandidates(),
        api.getInterviews(),
        api.getDepartments()
      ]);
      setJobs(jobsRes);
      setCandidates(candidatesRes);
      setInterviews(interviewsRes);
      setDepartments(deptsRes);

      const empRes = await api.getEmployees({ limit: 1000 });
      setEmployees(empRes.data || []);
    } catch (err) {
      console.error('Error loading recruitment data:', err);
      message.error('Failed to load recruitment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Job Submission Handler
  const handleJobSubmit = async (values: any) => {
    try {
      await api.createJob(values);
      message.success('Job opening created successfully.');
      setIsJobModalOpen(false);
      jobForm.resetFields();
      loadData();
    } catch (err) {
      console.error('Error creating job:', err);
      message.error('Failed to create job opening.');
    }
  };

  // Stage Update Handler
  const handleStageChange = async (candidateId: number, newStage: Candidate['stage']) => {
    try {
      await api.updateCandidateStage(candidateId, newStage);
      message.success(`Candidate stage updated to ${newStage}.`);
      if (newStage === 'Joined') {
        Modal.success({
          title: 'Employee Onboarded',
          content: 'Candidate has been successfully hired. An active employee profile has been auto-created, leave balances initialized, and default onboarding checklist assigned.',
        });
      }
      loadData();
    } catch (err) {
      console.error('Error updating stage:', err);
      message.error('Failed to update stage.');
    }
  };

  // Interview Schedule Handler
  const handleInterviewSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        schedule_time: values.schedule_time.toISOString(),
      };
      await api.createInterview(payload);
      message.success('Interview scheduled successfully.');
      setIsInterviewModalOpen(false);
      interviewForm.resetFields();
      loadData();
    } catch (err) {
      console.error('Error scheduling interview:', err);
      message.error('Failed to schedule interview.');
    }
  };

  // Feedback Submission Handler
  const handleFeedbackSubmit = async (values: any) => {
    if (!selectedInterview) return;
    try {
      await api.createInterviewFeedback(selectedInterview.id, values);
      message.success('Interview feedback submitted.');
      
      // Auto complete interview status to completed
      await api.updateInterviewStatus(selectedInterview.id, 'Completed');
      
      setIsFeedbackModalOpen(false);
      feedbackForm.resetFields();
      loadData();
    } catch (err) {
      console.error('Error submitting feedback:', err);
      message.error('Failed to submit feedback.');
    }
  };

  const openFeedbackModal = async (interview: Interview) => {
    setSelectedInterview(interview);
    setIsFeedbackModalOpen(true);
    try {
      const fb = await api.getInterviewFeedback(interview.id);
      setFeedbacks(fb);
    } catch (err) {
      console.error('Error loading feedback:', err);
    }
  };

  // Analytics Helpers
  const stageStats = candidates.reduce((acc: { [key: string]: number }, cur) => {
    acc[cur.stage] = (acc[cur.stage] || 0) + 1;
    return acc;
  }, {});

  const stagePieData = Object.keys(stageStats).map(key => ({
    name: key,
    value: stageStats[key]
  }));

  const jobStats = candidates.reduce((acc: { [key: string]: number }, cur) => {
    const title = cur.job_title || 'General / Unspecified';
    acc[title] = (acc[title] || 0) + 1;
    return acc;
  }, {});

  const jobBarData = Object.keys(jobStats).map(key => ({
    name: key.length > 20 ? key.substring(0, 17) + '...' : key,
    Applicants: jobStats[key]
  }));

  // Table Columns
  const jobColumns = [
    {
      title: 'Job Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong style={{ color: '#0F172A' }}>{text}</Text>
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      key: 'department_name',
      render: (text: string) => <Tag color="blue">{text || 'Unassigned'}</Tag>
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => text ? dayjs(text).format('DD MMM YYYY') : '-'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'gold';
        if (status === 'Open') color = 'green';
        if (status === 'Closed') color = 'red';
        return (
          <Tag color={color} style={{ borderRadius: 6, fontWeight: 500 }}>
            {status}
          </Tag>
        );
      }
    }
  ];

  const candidateColumns = [
    {
      title: 'Candidate Name',
      key: 'name',
      render: (record: Candidate) => (
        <Space>
          <Avatar style={{ backgroundColor: 'var(--primary-color)' }}>{record.first_name[0]}</Avatar>
          <div>
            <Text strong>{`${record.first_name} ${record.last_name}`}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{record.email}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Applied Job',
      dataIndex: 'job_title',
      key: 'job_title',
      render: (text: string) => <Text type="secondary">{text || 'General Opening'}</Text>
    },
    {
      title: 'Stage Pipeline',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage: Candidate['stage'], record: Candidate) => (
        <Select
          value={stage}
          disabled={!isAdminOrHR}
          onChange={(val) => handleStageChange(record.id, val)}
          style={{ width: 150 }}
          dropdownStyle={{ borderRadius: 8 }}
        >
          <Option value="Applied">Applied</Option>
          <Option value="Screening">Screening</Option>
          <Option value="Technical">Technical</Option>
          <Option value="Manager Round">Manager Round</Option>
          <Option value="HR Round">HR Round</Option>
          <Option value="Offer">Offer</Option>
          <Option value="Joined">Joined</Option>
          <Option value="Rejected">Rejected</Option>
        </Select>
      )
    },
    {
      title: 'Application Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => text ? dayjs(text).format('DD MMM YYYY') : '-'
    },
    {
      title: 'Resume CV',
      key: 'resume',
      render: (record: Candidate) => (
        <Button 
          type="link" 
          icon={<FileTextOutlined />} 
          href={record.resume_url.startsWith('http') ? record.resume_url : `${SERVER_URL}${record.resume_url}`} 
          target="_blank"
          style={{ padding: 0 }}
        >
          Download
        </Button>
      )
    }
  ];

  const interviewColumns = [
    {
      title: 'Candidate',
      dataIndex: 'candidate_name',
      key: 'candidate_name',
      render: (text: string) => <Text strong>{text || 'Unknown Candidate'}</Text>
    },
    {
      title: 'Interviewer',
      dataIndex: 'interviewer_name',
      key: 'interviewer_name',
      render: (text: string) => <Text type="secondary">{text || 'TBD'}</Text>
    },
    {
      title: 'Schedule Time',
      dataIndex: 'schedule_time',
      key: 'schedule_time',
      render: (text: string) => text ? dayjs(text).format('DD MMM YYYY, hh:mm A') : '-'
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (text: string) => <Tag color="orange">{text}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'Completed') color = 'green';
        if (status === 'Cancelled') color = 'red';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Interview) => (
        <Space>
          <Button 
            type="primary" 
            size="small" 
            icon={<MessageOutlined />} 
            onClick={() => openFeedbackModal(record)}
          >
            Feedback
          </Button>
          {record.status === 'Scheduled' && isAdminOrHR && (
            <PopconfirmBtn 
              title="Cancel this interview?"
              onConfirm={async () => {
                await api.updateInterviewStatus(record.id, 'Cancelled');
                message.success('Interview cancelled.');
                loadData();
              }}
            />
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 600, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Recruitment Hub
          </Title>
          <Text type="secondary">Manage openings, candidate pipelines, and scheduling interviews.</Text>
        </div>
        {isAdminOrHR && (
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setIsJobModalOpen(true)}
            >
              Post Job Opening
            </Button>
            <Button 
              icon={<CalendarOutlined />} 
              onClick={() => setIsInterviewModalOpen(true)}
            >
              Schedule Interview
            </Button>
          </Space>
        )}
      </div>

      {/* Main Tabs Container */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="line"
        size="large"
        items={[
          {
            key: 'dashboard',
            label: <span><PieChartOutlined />Overview</span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: 16 }}>
                {/* Stats Panel */}
                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <Text type="secondary">Open Positions</Text>
                      <Title level={3} style={{ margin: '8px 0 0', fontWeight: 600 }}>
                        {jobs.filter(j => j.status === 'Open').length}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <Text type="secondary">Total Applicants</Text>
                      <Title level={3} style={{ margin: '8px 0 0', fontWeight: 600, color: '#3B82F6' }}>
                        {candidates.length}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <Text type="secondary">Scheduled Interviews</Text>
                      <Title level={3} style={{ margin: '8px 0 0', fontWeight: 600, color: '#F59E0B' }}>
                        {interviews.filter(i => i.status === 'Scheduled').length}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <Text type="secondary">Hired Employees</Text>
                      <Title level={3} style={{ margin: '8px 0 0', fontWeight: 600, color: '#10B981' }}>
                        {candidates.filter(c => c.stage === 'Joined').length}
                      </Title>
                    </Card>
                  </Col>
                </Row>

                {/* Charts Panel */}
                <Row gutter={[24, 24]}>
                  <Col xs={24} md={12}>
                    <Card title="Applicant Pipeline Stages" bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      {stagePieData.length > 0 ? (
                        <div style={{ height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stagePieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                              >
                                {stagePieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <ChartTooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <Empty description="No applicant data available" style={{ margin: '60px 0' }} />
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card title="Applicants Per Job Opening" bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      {jobBarData.length > 0 ? (
                        <div style={{ height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={jobBarData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={false} />
                              <ChartTooltip />
                              <Bar dataKey="Applicants" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <Empty description="No openings data available" style={{ margin: '60px 0' }} />
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            )
          },
          {
            key: 'jobs',
            label: <span><SolutionOutlined />Active Openings</span>,
            children: (
              <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: 16 }}>
                <Table 
                  columns={jobColumns} 
                  dataSource={jobs} 
                  loading={loading}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          },
          {
            key: 'candidates',
            label: <span><UserOutlined />Applicant Database</span>,
            children: (
              <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: 16 }}>
                <Table 
                  columns={candidateColumns} 
                  dataSource={candidates} 
                  loading={loading}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          },
          {
            key: 'interviews',
            label: <span><CalendarOutlined />Interviews Schedule</span>,
            children: (
              <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: 16 }}>
                <Table 
                  columns={interviewColumns} 
                  dataSource={interviews} 
                  loading={loading}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          }
        ]}
      />

      {/* --- MODALS --- */}
      {/* 1. Job Modal */}
      <Modal
        title="Post New Job Opening"
        open={isJobModalOpen}
        onCancel={() => setIsJobModalOpen(false)}
        footer={null}
        destroyOnClose
        style={{ borderRadius: 12 }}
      >
        <Form form={jobForm} layout="vertical" onFinish={handleJobSubmit}>
          <Form.Item name="title" label="Job Title" rules={[{ required: true, message: 'Please enter job title' }]}>
            <Input placeholder="e.g. Senior Frontend Engineer" />
          </Form.Item>
          <Form.Item name="department_id" label="Department" rules={[{ required: true, message: 'Please select department' }]}>
            <Select placeholder="Select department">
              {departments.map(d => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Job Description" rules={[{ required: true, message: 'Please enter job description' }]}>
            <TextArea rows={4} placeholder="Summarize role objectives and duties..." />
          </Form.Item>
          <Form.Item name="requirements" label="Key Requirements">
            <TextArea rows={3} placeholder="e.g. 5+ years experience with React and TypeScript..." />
          </Form.Item>
          <Form.Item name="status" label="Initial Status" initialValue="Open">
            <Select>
              <Option value="Draft">Draft</Option>
              <Option value="Open">Open</Option>
              <Option value="Closed">Closed</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsJobModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Publish Opening
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 2. Interview Modal */}
      <Modal
        title="Schedule Candidate Interview"
        open={isInterviewModalOpen}
        onCancel={() => setIsInterviewModalOpen(false)}
        footer={null}
        destroyOnClose
        style={{ borderRadius: 12 }}
      >
        <Form form={interviewForm} layout="vertical" onFinish={handleInterviewSubmit}>
          <Form.Item name="candidate_id" label="Candidate Applicant" rules={[{ required: true, message: 'Please select candidate' }]}>
            <Select placeholder="Select candidate" showSearch optionFilterProp="children">
              {candidates.filter(c => c.stage !== 'Joined' && c.stage !== 'Rejected').map(c => (
                <Option key={c.id} value={c.id}>{`${c.first_name} ${c.last_name} (${c.job_title || 'General'})`}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="interviewer_id" label="Interviewer Panel" rules={[{ required: true, message: 'Please select interviewer' }]}>
            <Select placeholder="Select interviewer" showSearch optionFilterProp="children">
              {employees.map(e => (
                <Option key={e.id} value={e.id}>{`${e.first_name} ${e.last_name} - ${e.designation}`}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="schedule_time" label="Schedule Date & Time" rules={[{ required: true, message: 'Please pick date/time' }]}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stage" label="Interview Stage" rules={[{ required: true, message: 'Please select stage' }]}>
            <Select placeholder="e.g. Technical Round 1">
              <Option value="Screening Interview">Screening Interview</Option>
              <Option value="Technical Round 1">Technical Round 1</Option>
              <Option value="Technical Round 2">Technical Round 2</Option>
              <Option value="Manager Round">Manager Round</Option>
              <Option value="HR & Culture Round">HR & Culture Round</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsInterviewModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Schedule Slot
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 3. Feedback Modal */}
      <Modal
        title={selectedInterview ? `Interview Feedback - ${selectedInterview.candidate_name}` : 'Feedback Details'}
        open={isFeedbackModalOpen}
        onCancel={() => setIsFeedbackModalOpen(false)}
        footer={null}
        destroyOnClose
        style={{ borderRadius: 12 }}
        width={600}
      >
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Past Feedback Scores</Text>
          {feedbacks.length > 0 ? (
            <Timeline mode="left" style={{ marginTop: 16 }}>
              {feedbacks.map(f => (
                <Timeline.Item key={f.id} color="var(--primary-color)">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>{f.interviewer_name || 'Panelist'}</Text>
                    <Space size={4}>
                      <StarOutlined style={{ color: '#F5A524' }} />
                      <Text strong>{f.score} / 10</Text>
                    </Space>
                  </div>
                  <Text style={{ display: 'block', marginTop: 4, color: '#475569' }}>{f.feedback_text}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(f.created_at).format('DD MMM YYYY, hh:mm A')}</Text>
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <Empty description="No feedback submitted yet." style={{ margin: '16px 0' }} />
          )}
        </div>

        {selectedInterview && selectedInterview.status === 'Scheduled' && (
          <Form form={feedbackForm} layout="vertical" onFinish={handleFeedbackSubmit} style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
            <Title level={5} style={{ margin: '0 0 12px 0' }}>Add Evaluation Feedback</Title>
            <Form.Item name="score" label="Score Rating (1-10)" rules={[{ required: true, message: 'Please select score' }]}>
              <Rate count={10} style={{ color: '#F5A524' }} />
            </Form.Item>
            <Form.Item name="feedback_text" label="Feedback Evaluation Comments" rules={[{ required: true, message: 'Please write comments' }]}>
              <TextArea rows={3} placeholder="Discuss candidate strengths, weaknesses, and recommendation..." />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsFeedbackModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit">
                  Submit Scorecard
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

// Quick helper component to avoid verbose code in file
const PopconfirmBtn: React.FC<{ title: string; onConfirm: () => void }> = ({ title, onConfirm }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="text" danger size="small" onClick={() => setOpen(true)} style={{ padding: '0 4px' }}>
        Cancel
      </Button>
      <Modal
        title={title}
        open={open}
        onOk={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
        okText="Yes"
        cancelText="No"
        okButtonProps={{ danger: true }}
        style={{ borderRadius: 12 }}
      >
        <p>Are you sure you want to cancel this interview slot?</p>
      </Modal>
    </>
  );
};

export default RecruitmentWorkspace;
