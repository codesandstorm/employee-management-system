import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Button, Space, Select, Modal, Form, Input, 
  Tag, Badge, Tabs, message, Tooltip, Alert, 
  Popconfirm, Divider, Typography 
} from 'antd';
import { 
  CalendarOutlined, 
  SwapOutlined, 
  PlusOutlined, 
  LeftOutlined, 
  RightOutlined, 
  CheckOutlined, 
  CloseOutlined, 
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Shift, EmployeeShift, Employee } from '../../types';

dayjs.extend(isoWeek);
const { Text } = Typography;

export const RosterWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('calendar');
  
  // Date range state (defaults to current week Monday)
  const [startOfWeek, setStartOfWeek] = useState<dayjs.Dayjs>(dayjs().startOf('isoWeek'));
  
  // Data States
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roster, setRoster] = useState<EmployeeShift[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(false);
  const [isShiftTemplateModalOpen, setIsShiftTemplateModalOpen] = useState<boolean>(false);
  
  // Selected items for assign/swap
  const [selectedCell, setSelectedCell] = useState<{ employeeId: number; date: string } | null>(null);
  const [formAssign] = Form.useForm();
  const [formSwap] = Form.useForm();
  const [formTemplate] = Form.useForm();
  const [editingTemplate, setEditingTemplate] = useState<Shift | null>(null);

  const canManageShifts = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'HR' || user?.role === 'Manager';
  const isEmployeeOrIntern = user?.role === 'Employee' || user?.role === 'Intern';

  // Dates for the selected 7-day week
  const weekDates = Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, 'day'));
  const startDateStr = weekDates[0].format('YYYY-MM-DD');
  const endDateStr = weekDates[6].format('YYYY-MM-DD');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch shifts templates
      const shiftTemplates = await api.getShifts();
      setShifts(shiftTemplates);

      // Fetch employees list
      const empRes = await api.getEmployees({ limit: 1000 });
      setEmployees(empRes.data || []);

      // Fetch assigned shifts for selected week
      const rosterData = await api.getEmployeeShifts({
        startDate: startDateStr,
        endDate: endDateStr
      });
      setRoster(rosterData);
    } catch (err) {
      console.error('Error fetching roster data:', err);
      message.error('Failed to load roster workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startOfWeek]);

  const handlePrevWeek = () => {
    setStartOfWeek(prev => prev.subtract(1, 'week'));
  };

  const handleNextWeek = () => {
    setStartOfWeek(prev => prev.add(1, 'week'));
  };

  const handleToday = () => {
    setStartOfWeek(dayjs().startOf('isoWeek'));
  };

  // Open assign shift modal
  const handleCellClick = (employeeId: number, date: string, existingShiftId?: number) => {
    if (!canManageShifts) return;
    setSelectedCell({ employeeId, date });
    formAssign.setFieldsValue({
      shift_id: existingShiftId || undefined
    });
    setIsAssignModalOpen(true);
  };

  // Assign shift submission
  const handleAssignShiftSubmit = async (values: { shift_id: number }) => {
    if (!selectedCell) return;
    try {
      await api.assignEmployeeShift({
        employee_id: selectedCell.employeeId,
        shift_id: values.shift_id,
        date: selectedCell.date
      });
      message.success('Shift assigned successfully.');
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Assign shift error:', err);
      message.error('Failed to assign shift.');
    }
  };

  // Shift template CRUD submissions
  const handleTemplateSubmit = async (values: any) => {
    try {
      if (editingTemplate) {
        await api.updateShift(editingTemplate.id, values);
        message.success('Shift template updated successfully.');
      } else {
        await api.createShift(values);
        message.success('New shift template created.');
      }
      setIsShiftTemplateModalOpen(false);
      setEditingTemplate(null);
      formTemplate.resetFields();
      fetchData();
    } catch (err) {
      console.error('Template submission error:', err);
      message.error('Failed to save shift template.');
    }
  };

  const handleEditTemplate = (shift: Shift) => {
    setEditingTemplate(shift);
    formTemplate.setFieldsValue({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      color: shift.color
    });
    setIsShiftTemplateModalOpen(true);
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      await api.deleteShift(id);
      message.success('Shift template deleted.');
      fetchData();
    } catch (err) {
      console.error('Delete template error:', err);
      message.error('Failed to delete shift template. It might be assigned to employees.');
    }
  };

  // Request Shift Swap Submission
  const handleSwapSubmit = async (values: { employeeShiftId: number; targetEmployeeId: number; remarks: string }) => {
    try {
      await api.requestShiftSwap(values);
      message.success('Shift swap request submitted to coworker.');
      setIsSwapModalOpen(false);
      formSwap.resetFields();
      fetchData();
    } catch (err) {
      console.error('Swap request error:', err);
      message.error('Failed to request shift swap.');
    }
  };

  // Accept/Reject or Process swap requests
  const handleProcessSwap = async (swapId: number, status: 'Approved' | 'Rejected') => {
    try {
      await api.processShiftSwap({
        employeeShiftId: swapId,
        status
      });
      message.success(`Shift swap request successfully ${status.toLowerCase()}.`);
      fetchData();
    } catch (err) {
      console.error('Process swap error:', err);
      message.error('Failed to process shift swap.');
    }
  };

  // Helper to filter roster assignments for specific cell
  const getCellShift = (employeeId: number, dateStr: string) => {
    return roster.find(es => es.employee_id === employeeId && es.date.split('T')[0] === dateStr);
  };

  // Roster Columns Generation
  const columns = [
    {
      title: 'Employee Name & Role',
      key: 'employee',
      width: 250,
      fixed: 'left' as const,
      render: (_: any, record: Employee) => (
        <Space direction="vertical" size={0}>
          <Text strong>{`${record.first_name} ${record.last_name}`}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.designation} • <Tag style={{ margin: 0, padding: '0 4px', fontSize: '10px' }}>{record.role}</Tag>
          </Text>
        </Space>
      )
    },
    ...weekDates.map(date => {
      const dateStr = date.format('YYYY-MM-DD');
      const isToday = date.isSame(dayjs(), 'day');
      
      return {
        title: (
          <div style={{ textAlign: 'center', color: isToday ? 'var(--primary-color)' : 'inherit' }}>
            <div>{date.format('ddd')}</div>
            <div style={{ fontSize: '12px', fontWeight: isToday ? 'bold' : 'normal' }}>{date.format('MMM DD')}</div>
          </div>
        ),
        key: dateStr,
        align: 'center' as const,
        render: (_: any, record: Employee) => {
          const cellShift = getCellShift(record.id, dateStr);
          
          if (cellShift) {
            const label = (
              <div 
                style={{ 
                  backgroundColor: cellShift.shift_color || 'var(--primary-color)', 
                  color: '#ffffff', 
                  borderRadius: '4px',
                  padding: '6px 8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: canManageShifts ? 'pointer' : 'default',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                onClick={() => handleCellClick(record.id, dateStr, cellShift.shift_id)}
              >
                <div>{cellShift.shift_name}</div>
                <div style={{ fontSize: '10px', opacity: 0.9 }}>
                  {cellShift.shift_start?.slice(0, 5)} - {cellShift.shift_end?.slice(0, 5)}
                </div>
                {cellShift.swap_requested && (
                  <Badge 
                    status="processing" 
                    text={
                      <span style={{ color: '#fff', fontSize: '9px', fontWeight: 'bold' }}>
                        Swap: {cellShift.swap_status}
                      </span>
                    } 
                  />
                )}
              </div>
            );

            return canManageShifts ? (
              <Tooltip title="Click to reassign shift">
                {label}
              </Tooltip>
            ) : label;
          }

          // Off Cell
          return (
            <div 
              style={{ 
                padding: '12px 8px', 
                color: 'var(--text-secondary)',
                fontSize: '12px',
                border: '1px dashed #e8e8e8',
                borderRadius: '4px',
                cursor: canManageShifts ? 'pointer' : 'default',
                transition: 'all 0.3s'
              }}
              className="roster-cell-off"
              onClick={() => handleCellClick(record.id, dateStr)}
            >
              {canManageShifts ? <span style={{ color: 'var(--primary-color)' }}>+ Assign</span> : 'Off'}
            </div>
          );
        }
      };
    })
  ];

  // Filters for shift swaps
  const mySwapRequests = roster.filter(es => es.employee_id === user?.id && es.swap_requested);
  const swapsTargetedToMe = roster.filter(es => es.swap_target_employee_id === user?.id && es.swap_requested && es.swap_status === 'Pending');
  const allPendingManagerSwaps = roster.filter(es => es.swap_requested && es.swap_status === 'Pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 600, 
            letterSpacing: '-0.03em', 
            color: '#000000',
            marginBottom: '4px'
          }}>
            Shift & Roster Workspace
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Plan shift rotations, schedule weekly rosters, and manage shift swap requests.
          </p>
        </div>
        
        <Space size="middle">
          {isEmployeeOrIntern && (
            <Button 
              type="primary" 
              icon={<SwapOutlined />} 
              onClick={() => {
                formSwap.resetFields();
                setIsSwapModalOpen(true);
              }}
            >
              Request Roster Swap
            </Button>
          )}

          {canManageShifts && (
            <Button 
              type="primary"
              icon={<PlusOutlined />} 
              onClick={() => {
                setEditingTemplate(null);
                formTemplate.resetFields();
                setIsShiftTemplateModalOpen(true);
              }}
            >
              New Shift Template
            </Button>
          )}
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="line" size="large">
        <Tabs.TabPane 
          tab={<Space><CalendarOutlined /><span>Weekly Roster Calendar</span></Space>} 
          key="calendar"
        >
          {/* Calendar Navigation & Info Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <Space>
              <Button icon={<LeftOutlined />} onClick={handlePrevWeek} />
              <Button onClick={handleToday}>Current Week</Button>
              <Button icon={<RightOutlined />} onClick={handleNextWeek} />
              <Text strong style={{ fontSize: '16px', marginLeft: '8px' }}>
                {weekDates[0].format('MMM DD, YYYY')} – {weekDates[6].format('MMM DD, YYYY')}
              </Text>
            </Space>

            <Space size="large">
              <Badge color="#1E2A4A" text="Morning (09:00 - 17:00)" />
              <Badge color="#F5A524" text="Evening (16:00 - 00:00)" />
              <Badge color="#E5484D" text="Night (00:00 - 08:00)" />
            </Space>
          </div>

          <Card style={{ borderRadius: '8px', overflow: 'hidden' }}>
            <Table
              columns={columns}
              dataSource={employees.filter(emp => emp.status !== 'Inactive')}
              rowKey="id"
              pagination={false}
              bordered
              loading={loading}
              scroll={{ x: 1000 }}
              size="middle"
            />
          </Card>
        </Tabs.TabPane>

        {/* Shift Templates Tab */}
        <Tabs.TabPane 
          tab={<Space><ClockCircleOutlined /><span>Shift Templates</span></Space>} 
          key="templates"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {shifts.map(shift => (
              <Card 
                key={shift.id} 
                style={{ borderLeft: `6px solid ${shift.color}` }}
                actions={
                  canManageShifts ? [
                    <Button type="link" onClick={() => handleEditTemplate(shift)}>Edit</Button>,
                    <Popconfirm 
                      title="Are you sure you want to delete this shift template?" 
                      onConfirm={() => handleDeleteTemplate(shift.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type="link" danger>Delete</Button>
                    </Popconfirm>
                  ] : undefined
                }
              >
                <Typography.Title level={4} style={{ margin: '0 0 8px 0', color: shift.color }}>
                  {shift.name}
                </Typography.Title>
                <Space direction="vertical" size="small">
                  <div>
                    <Text strong>Start Time:</Text> {shift.start_time}
                  </div>
                  <div>
                    <Text strong>End Time:</Text> {shift.end_time}
                  </div>
                  <Tag color={shift.color} style={{ color: '#fff', border: 'none' }}>
                    Visualizer Code: {shift.color}
                  </Tag>
                </Space>
              </Card>
            ))}
          </div>
        </Tabs.TabPane>

        {/* Swap Requests Tab */}
        <Tabs.TabPane 
          tab={
            <Space>
              <SwapOutlined />
              <span>Roster Swaps</span>
              {swapsTargetedToMe.length > 0 && <Badge count={swapsTargetedToMe.length} style={{ backgroundColor: '#E5484D' }} />}
            </Space>
          } 
          key="swaps"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
            
            {/* Targeted To Me Swaps (Coworker Approvals) */}
            {isEmployeeOrIntern && (
              <Card title="Swap Requests Awaiting Your Acceptance" headStyle={{ backgroundColor: '#F7F8FA' }}>
                {swapsTargetedToMe.length === 0 ? (
                  <Text type="secondary">No coworkers have requested shift swaps with you.</Text>
                ) : (
                  <Table
                    rowKey="id"
                    dataSource={swapsTargetedToMe}
                    pagination={false}
                    size="middle"
                    columns={[
                      {
                        title: 'Coworker',
                        dataIndex: 'employee_name',
                        key: 'employee_name',
                        render: (text) => <Text strong>{text}</Text>
                      },
                      {
                        title: 'Date of Swap',
                        dataIndex: 'date',
                        key: 'date',
                        render: (val) => dayjs(val).format('LL')
                      },
                      {
                        title: 'Original Shift',
                        key: 'shift',
                        render: (_, record) => (
                          <Tag color={record.shift_color || 'var(--primary-color)'}>
                            {record.shift_name} ({record.shift_start?.slice(0, 5)} - {record.shift_end?.slice(0, 5)})
                          </Tag>
                        )
                      },
                      {
                        title: 'Remarks / Reason',
                        dataIndex: 'remarks',
                        key: 'remarks'
                      },
                      {
                        title: 'Actions',
                        key: 'actions',
                        render: (_, record) => (
                          <Space>
                            <Button 
                              type="primary" 
                              icon={<CheckOutlined />} 
                              onClick={() => handleProcessSwap(record.id, 'Approved')}
                            >
                              Accept & Swap
                            </Button>
                            <Button 
                              danger 
                              icon={<CloseOutlined />} 
                              onClick={() => handleProcessSwap(record.id, 'Rejected')}
                            >
                              Decline
                            </Button>
                          </Space>
                        )
                      }
                    ]}
                  />
                )}
              </Card>
            )}

            {/* My Sent Swap Requests */}
            {isEmployeeOrIntern && (
              <Card title="My Swap Requests Status">
                {mySwapRequests.length === 0 ? (
                  <Text type="secondary">You have not requested any shift swaps.</Text>
                ) : (
                  <Table
                    rowKey="id"
                    dataSource={mySwapRequests}
                    pagination={false}
                    size="middle"
                    columns={[
                      {
                        title: 'Date',
                        dataIndex: 'date',
                        key: 'date',
                        render: (val) => dayjs(val).format('LL')
                      },
                      {
                        title: 'My Shift to Swap',
                        key: 'shift',
                        render: (_, record) => (
                          <Tag color={record.shift_color || 'var(--primary-color)'}>
                            {record.shift_name} ({record.shift_start?.slice(0, 5)} - {record.shift_end?.slice(0, 5)})
                          </Tag>
                        )
                      },
                      {
                        title: 'Swap Target Coworker',
                        key: 'target',
                        render: (_, record) => {
                          const targetEmp = employees.find(e => e.id === record.swap_target_employee_id);
                          return <Text>{targetEmp ? `${targetEmp.first_name} ${targetEmp.last_name}` : `Emp ID: ${record.swap_target_employee_id}`}</Text>;
                        }
                      },
                      {
                        title: 'Remarks',
                        dataIndex: 'remarks',
                        key: 'remarks'
                      },
                      {
                        title: 'Status',
                        dataIndex: 'swap_status',
                        key: 'swap_status',
                        render: (val) => (
                          <Tag color={
                            val === 'Approved' ? 'success' :
                            val === 'Rejected' ? 'error' : 'processing'
                          }>
                            {val}
                          </Tag>
                        )
                      }
                    ]}
                  />
                )}
              </Card>
            )}

            {/* Manager Approvals */}
            {canManageShifts && (
              <Card title="Roster Swaps Pipeline Overview (Admin/Manager Console)">
                {allPendingManagerSwaps.length === 0 ? (
                  <Text type="secondary">No active swap pipelines require monitoring.</Text>
                ) : (
                  <Table
                    rowKey="id"
                    dataSource={allPendingManagerSwaps}
                    pagination={false}
                    size="middle"
                    columns={[
                      {
                        title: 'Requester',
                        dataIndex: 'employee_name',
                        key: 'employee_name'
                      },
                      {
                        title: 'Shift Date',
                        dataIndex: 'date',
                        key: 'date',
                        render: (val) => dayjs(val).format('LL')
                      },
                      {
                        title: 'Shift',
                        key: 'shift',
                        render: (_, record) => (
                          <Tag color={record.shift_color}>
                            {record.shift_name} ({record.shift_start?.slice(0, 5)} - {record.shift_end?.slice(0, 5)})
                          </Tag>
                        )
                      },
                      {
                        title: 'Target Coworker',
                        key: 'target',
                        render: (_, record) => {
                          const targetEmp = employees.find(e => e.id === record.swap_target_employee_id);
                          return <Text>{targetEmp ? `${targetEmp.first_name} ${targetEmp.last_name}` : `Emp ID: ${record.swap_target_employee_id}`}</Text>;
                        }
                      },
                      {
                        title: 'Remarks',
                        dataIndex: 'remarks',
                        key: 'remarks'
                      },
                      {
                        title: 'Swap Status',
                        dataIndex: 'swap_status',
                        key: 'swap_status',
                        render: (val) => <Tag color="warning">{val}</Tag>
                      },
                      {
                        title: 'Override Actions',
                        key: 'actions',
                        render: (_, record) => (
                          <Space>
                            <Button 
                              size="small"
                              type="primary" 
                              icon={<CheckOutlined />} 
                              onClick={() => handleProcessSwap(record.id, 'Approved')}
                            >
                              Approve Swap
                            </Button>
                            <Button 
                              size="small"
                              danger 
                              icon={<CloseOutlined />} 
                              onClick={() => handleProcessSwap(record.id, 'Rejected')}
                            >
                              Deny Swap
                            </Button>
                          </Space>
                        )
                      }
                    ]}
                  />
                )}
              </Card>
            )}

          </div>
        </Tabs.TabPane>
      </Tabs>

      {/* ASSIGN SHIFT MODAL */}
      <Modal
        title="Assign Roster Shift"
        open={isAssignModalOpen}
        onCancel={() => setIsAssignModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={formAssign} onFinish={handleAssignShiftSubmit} layout="vertical">
          <Form.Item label="Roster Date">
            <Input value={selectedCell ? dayjs(selectedCell.date).format('LL') : ''} disabled />
          </Form.Item>
          <Form.Item 
            name="shift_id" 
            label="Select Shift Template" 
            rules={[{ required: true, message: 'Please select a shift template.' }]}
          >
            <Select placeholder="Choose Shift">
              {shifts.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  <Space>
                    <Badge color={s.color} />
                    <span>{s.name} ({s.start_time} - {s.end_time})</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Assign Roster
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* REQUEST SHIFT SWAP MODAL */}
      <Modal
        title="Submit Shift Swap Request"
        open={isSwapModalOpen}
        onCancel={() => setIsSwapModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={formSwap} onFinish={handleSwapSubmit} layout="vertical">
          <Form.Item 
            name="employeeShiftId" 
            label="My Shift to Swap"
            rules={[{ required: true, message: 'Select your scheduled shift to swap.' }]}
          >
            <Select placeholder="Choose one of your assigned shifts">
              {roster
                .filter(es => es.employee_id === user?.id && !es.swap_requested)
                .map(es => (
                  <Select.Option key={es.id} value={es.id}>
                    {dayjs(es.date).format('ddd MMM DD')} — {es.shift_name}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="targetEmployeeId" 
            label="Swap Coworker"
            rules={[{ required: true, message: 'Select coworker to swap roster schedules.' }]}
          >
            <Select placeholder="Choose target coworker">
              {employees
                .filter(emp => emp.id !== user?.id && emp.status === 'Active')
                .map(emp => (
                  <Select.Option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.designation})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="remarks" 
            label="Remarks / Reason for Swap"
            rules={[{ required: true, message: 'Please write a brief reason.' }]}
          >
            <Input.TextArea placeholder="Provide context on why you want to swap shifts" rows={3} />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsSwapModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Submit Swap Request
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* CREATE/EDIT SHIFT TEMPLATE MODAL */}
      <Modal
        title={editingTemplate ? "Edit Shift Template" : "Create Shift Template"}
        open={isShiftTemplateModalOpen}
        onCancel={() => setIsShiftTemplateModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={formTemplate} onFinish={handleTemplateSubmit} layout="vertical">
          <Form.Item 
            name="name" 
            label="Shift Template Name"
            rules={[{ required: true, message: 'Enter a descriptive shift name.' }]}
          >
            <Input placeholder="e.g. Morning Shift, Evening Shift, Weekend Support" />
          </Form.Item>

          <Form.Item 
            name="start_time" 
            label="Start Time"
            rules={[{ required: true, message: 'Enter shift start time (HH:MM:SS).' }]}
          >
            <Input placeholder="e.g. 09:00:00 or 16:00:00" />
          </Form.Item>

          <Form.Item 
            name="end_time" 
            label="End Time"
            rules={[{ required: true, message: 'Enter shift end time (HH:MM:SS).' }]}
          >
            <Input placeholder="e.g. 17:00:00 or 00:00:00" />
          </Form.Item>

          <Form.Item 
            name="color" 
            label="Calendar Color Label (Hex code)"
            rules={[{ required: true, message: 'Choose a hexadecimal color.' }]}
          >
            <Select placeholder="Select Color">
              <Select.Option value="#1E2A4A"><Badge color="#1E2A4A" text="Deep Ink Navy (#1E2A4A)" /></Select.Option>
              <Select.Option value="#F5A524"><Badge color="#F5A524" text="Warm Amber (#F5A524)" /></Select.Option>
              <Select.Option value="#E5484D"><Badge color="#E5484D" text="Rose Red (#E5484D)" /></Select.Option>
              <Select.Option value="#2DBE8C"><Badge color="#2DBE8C" text="Emerald Green (#2DBE8C)" /></Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsShiftTemplateModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RosterWorkspace;
