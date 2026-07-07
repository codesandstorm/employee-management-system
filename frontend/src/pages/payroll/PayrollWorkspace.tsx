import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Table, Tag, Button, Modal, Form,
  Input, InputNumber, Select, Space, Typography, message, Empty, Tabs, Descriptions, Divider
} from 'antd';
import {
  PlusOutlined,
  BankOutlined,
  SettingOutlined,
  UserOutlined,
  CalculatorOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SalaryStructure, EmployeeSalary, Employee } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;

export const PayrollWorkspace: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'HR';

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Salary assignment data state
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [employeeSalary, setEmployeeSalary] = useState<EmployeeSalary | null>(null);
  const [loadingSalary, setLoadingSalary] = useState<boolean>(false);

  // Modals
  const [isStructureModalOpen, setIsStructureModalOpen] = useState<boolean>(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);

  const [structureForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  // Allowances & Deductions dynamic inputs state for creation form
  const [allowanceList, setAllowanceList] = useState<{ key: string; value: number }[]>([
    { key: 'HRA', value: 0 },
    { key: 'Medical Allowance', value: 0 },
    { key: 'Transport Allowance', value: 0 }
  ]);
  const [deductionList, setDeductionList] = useState<{ key: string; value: number }[]>([
    { key: 'Provident Fund (PF)', value: 0 },
    { key: 'Professional Tax', value: 0 }
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const structsRes = await api.getSalaryStructures();
      setStructures(structsRes);

      const empsRes = await api.getEmployees({ limit: 1000 });
      setEmployees(empsRes.data || []);
    } catch (err) {
      console.error('Error loading payroll data:', err);
      message.error('Failed to load payroll parameters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadEmployeeSalary = async (employeeId: number) => {
    setLoadingSalary(true);
    setEmployeeSalary(null);
    try {
      const sal = await api.getEmployeeSalary(employeeId);
      setEmployeeSalary(sal);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Error loading employee salary:', err);
        message.error('Error loading employee payroll settings.');
      }
    } finally {
      setLoadingSalary(false);
    }
  };

  const handleCreateStructure = async (values: any) => {
    try {
      // Map allowances list to JSON record
      const allowances: Record<string, number> = {};
      allowanceList.forEach(item => {
        if (item.key.trim()) allowances[item.key.trim()] = item.value;
      });

      // Map deductions list to JSON record
      const deductions: Record<string, number> = {};
      deductionList.forEach(item => {
        if (item.key.trim()) deductions[item.key.trim()] = item.value;
      });

      const payload = {
        name: values.name,
        base_salary: parseFloat(values.base_salary),
        allowances,
        deductions
      };

      await api.createSalaryStructure(payload);
      message.success('Salary structure created successfully.');
      setIsStructureModalOpen(false);
      structureForm.resetFields();
      loadData();
    } catch (err) {
      console.error('Error creating salary structure:', err);
      message.error('Failed to create salary structure.');
    }
  };

  const handleAssignSalary = async (values: any) => {
    try {
      const payload = {
        employee_id: values.employee_id,
        structure_id: values.structure_id,
        bank_name: values.bank_name || null,
        account_number: values.account_number || null,
        tax_identifier: values.tax_identifier || null,
        effective_date: values.effective_date
      };

      await api.assignEmployeeSalary(payload);
      message.success('Salary structure assigned to employee successfully.');
      setIsAssignModalOpen(false);
      assignForm.resetFields();
      if (selectedEmpId === values.employee_id && selectedEmpId !== null) {
        loadEmployeeSalary(selectedEmpId);
      }
      loadData();
    } catch (err) {
      console.error('Error assigning salary structure:', err);
      message.error('Failed to assign salary structure.');
    }
  };

  // Helper calculation for structures summary
  const calculateGrossSalary = (base: number, allowances: Record<string, number>) => {
    const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + Number(val), 0);
    return base + totalAllowances;
  };

  const calculateNetSalary = (base: number, allowances: Record<string, number>, deductions: Record<string, number>) => {
    const gross = calculateGrossSalary(base, allowances);
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + Number(val), 0);
    return gross - totalDeductions;
  };

  const columns = [
    {
      title: 'Structure Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Base Salary ($)',
      dataIndex: 'base_salary',
      key: 'base_salary',
      render: (val: number) => `$${Number(val).toLocaleString()}`
    },
    {
      title: 'Gross Salary ($)',
      key: 'gross',
      render: (record: SalaryStructure) => `$${calculateGrossSalary(Number(record.base_salary), record.allowances).toLocaleString()}`
    },
    {
      title: 'Deductions ($)',
      key: 'deductions',
      render: (record: SalaryStructure) => {
        const total = Object.values(record.deductions).reduce((sum, val) => sum + Number(val), 0);
        return <Text type="danger">${total.toLocaleString()}</Text>;
      }
    },
    {
      title: 'Net Salary ($)',
      key: 'net',
      render: (record: SalaryStructure) => (
        <Tag color="success" style={{ fontSize: '13px', padding: '4px 8px' }}>
          ${calculateNetSalary(Number(record.base_salary), record.allowances, record.deductions).toLocaleString()}
        </Tag>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0, fontWeight: 600 }}>Payroll Foundation Console</Title>
          <Text type="secondary">Define salary bands, configure structured components, and assign compensation templates</Text>
        </Col>
        <Col>
          {isAdminOrHR && (
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsStructureModalOpen(true)}
              >
                Create Structure Template
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setIsAssignModalOpen(true)}
              >
                Assign Compensation Structure
              </Button>
            </Space>
          )}
        </Col>
      </Row>

      <Tabs defaultActiveKey="catalog" items={[
        {
          key: 'catalog',
          label: 'Salary Structure Catalog',
          children: (
            <Card style={{ borderRadius: 12, marginTop: 16 }} bodyStyle={{ padding: 0 }}>
              <Table
                columns={columns}
                dataSource={structures}
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                expandable={{
                  expandedRowRender: (record) => (
                    <div style={{ padding: '8px 24px', backgroundColor: '#F7F8FA' }}>
                      <Row gutter={32}>
                        <Col span={12}>
                          <Text strong style={{ display: 'block', marginBottom: 8 }}>Allowances Breakdown</Text>
                          {Object.keys(record.allowances).length > 0 ? (
                            Object.entries(record.allowances).map(([k, v]) => (
                              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <Text type="secondary">{k}</Text>
                                <Text>${Number(v).toLocaleString()}</Text>
                              </div>
                            ))
                          ) : <Text type="secondary">No allowances configured.</Text>}
                        </Col>
                        <Col span={12}>
                          <Text strong style={{ display: 'block', marginBottom: 8, color: '#E5484D' }}>Deductions Breakdown</Text>
                          {Object.keys(record.deductions).length > 0 ? (
                            Object.entries(record.deductions).map(([k, v]) => (
                              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                <Text type="secondary">{k}</Text>
                                <Text type="danger">-${Number(v).toLocaleString()}</Text>
                              </div>
                            ))
                          ) : <Text type="secondary">No deductions configured.</Text>}
                        </Col>
                      </Row>
                    </div>
                  )
                }}
              />
            </Card>
          )
        },
        {
          key: 'assignments',
          label: 'Employee Payroll Profiles',
          children: (
            <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
              <Col xs={24} md={8}>
                <Card title="Select Employee" style={{ borderRadius: 12 }}>
                  <Select
                    showSearch
                    placeholder="Search employee..."
                    style={{ width: '100%' }}
                    value={selectedEmpId}
                    onChange={(value) => {
                      setSelectedEmpId(value);
                      loadEmployeeSalary(value);
                    }}
                    filterOption={(input, option) =>
                      (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {employees.map(emp => (
                      <Option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.role})
                      </Option>
                    ))}
                  </Select>
                  {!selectedEmpId && (
                    <div style={{ marginTop: 24, textAlign: 'center', color: '#94A3B8' }}>
                      <UserOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                      <Text type="secondary">Select an employee from the list to view their salary profile.</Text>
                    </div>
                  )}
                </Card>
              </Col>
              <Col xs={24} md={16}>
                {selectedEmpId ? (
                  loadingSalary ? (
                    <Card style={{ borderRadius: 12 }} loading />
                  ) : employeeSalary ? (
                    <Card style={{ borderRadius: 12 }} title="Compensation & Bank details">
                      <Descriptions bordered column={2}>
                        <Descriptions.Item label="Effective Date">{employeeSalary.effective_date}</Descriptions.Item>
                        <Descriptions.Item label="Structure Assigned">
                          <Tag color="blue">
                            {structures.find(s => s.id === employeeSalary.structure_id)?.name || 'Custom Plan'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Bank Name">{employeeSalary.bank_name || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Account Number">{employeeSalary.account_number || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Tax ID / PAN" span={2}>{employeeSalary.tax_identifier || 'N/A'}</Descriptions.Item>
                      </Descriptions>

                      <Divider />

                      <Title level={4} style={{ display: 'flex', alignItems: 'center' }}>
                        <CalculatorOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
                        Payslip Simulation Breakdown
                      </Title>
                      
                      {(() => {
                        const struct = structures.find(s => s.id === employeeSalary.structure_id);
                        if (!struct) return <Text type="secondary">No structure data details found.</Text>;
                        
                        const gross = calculateGrossSalary(Number(struct.base_salary), struct.allowances);
                        const totalDeductions = Object.values(struct.deductions).reduce((sum, val) => sum + Number(val), 0);
                        const net = gross - totalDeductions;

                        return (
                          <div style={{ backgroundColor: '#F7F8FA', padding: 20, borderRadius: 8 }}>
                            <Row gutter={24}>
                              <Col span={12}>
                                <Text strong style={{ display: 'block', marginBottom: 12 }}>Earnings</Text>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                                  <Text>Basic Base Salary</Text>
                                  <Text>${Number(struct.base_salary).toLocaleString()}</Text>
                                </div>
                                {Object.entries(struct.allowances).map(([k, v]) => (
                                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                                    <Text>{k}</Text>
                                    <Text>${Number(v).toLocaleString()}</Text>
                                  </div>
                                ))}
                              </Col>
                              <Col span={12}>
                                <Text strong style={{ display: 'block', marginBottom: 12, color: '#E5484D' }}>Deductions</Text>
                                {Object.entries(struct.deductions).map(([k, v]) => (
                                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                                    <Text>{k}</Text>
                                    <Text type="danger">-${Number(v).toLocaleString()}</Text>
                                  </div>
                                ))}
                              </Col>
                            </Row>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text strong>Gross Salary:</Text>
                              <Text strong>${gross.toLocaleString()}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                              <Text strong>Total Deductions:</Text>
                              <Text type="danger" strong>-${totalDeductions.toLocaleString()}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTop: '2px dashed #E4E7EC', paddingTop: 16 }}>
                              <Title level={4} style={{ margin: 0 }}>Net Take-Home Pay:</Title>
                              <Title level={4} style={{ margin: 0, color: 'var(--success-color)' }}>${net.toLocaleString()} / month</Title>
                            </div>
                          </div>
                        );
                      })()}
                    </Card>
                  ) : (
                    <Card style={{ borderRadius: 12 }}>
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No salary structures or bank configs assigned to this employee."
                      >
                        {isAdminOrHR && (
                          <Button type="primary" onClick={() => setIsAssignModalOpen(true)}>
                            Assign Compensation Now
                          </Button>
                        )}
                      </Empty>
                    </Card>
                  )
                ) : null}
              </Col>
            </Row>
          )
        }
      ]} />

      {/* Structure Template Modal */}
      <Modal
        title="Create Salary Structure Template"
        open={isStructureModalOpen}
        onCancel={() => setIsStructureModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={structureForm} layout="vertical" onFinish={handleCreateStructure}>
          <Form.Item
            name="name"
            label="Structure Template Name"
            rules={[{ required: true, message: 'Please input template name!' }]}
          >
            <Input placeholder="e.g. SDE-1 Standard Comp Package" />
          </Form.Item>

          <Form.Item
            name="base_salary"
            label="Base Basic Monthly Salary ($)"
            rules={[{ required: true, message: 'Please input base salary!' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 5000" />
          </Form.Item>

          <Divider style={{ margin: '16px 0' }} />
          
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Allowances Configuration</Text>
          {allowanceList.map((item, idx) => (
            <Row gutter={16} key={`allowance-${idx}`} style={{ marginBottom: 12 }}>
              <Col span={14}>
                <Input
                  value={item.key}
                  placeholder="Allowance name"
                  onChange={(e) => {
                    const newList = [...allowanceList];
                    newList[idx].key = e.target.value;
                    setAllowanceList(newList);
                  }}
                />
              </Col>
              <Col span={10}>
                <InputNumber
                  style={{ width: '100%' }}
                  value={item.value}
                  min={0}
                  placeholder="Value ($)"
                  onChange={(val) => {
                    const newList = [...allowanceList];
                    newList[idx].value = Number(val);
                    setAllowanceList(newList);
                  }}
                />
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setAllowanceList([...allowanceList, { key: '', value: 0 }])}
            style={{ width: '100%', marginBottom: 16 }}
          >
            Add Custom Allowance Component
          </Button>

          <Divider style={{ margin: '16px 0' }} />

          <Text strong style={{ display: 'block', marginBottom: 12, color: '#E5484D' }}>Deductions Configuration</Text>
          {deductionList.map((item, idx) => (
            <Row gutter={16} key={`deduction-${idx}`} style={{ marginBottom: 12 }}>
              <Col span={14}>
                <Input
                  value={item.key}
                  placeholder="Deduction name"
                  onChange={(e) => {
                    const newList = [...deductionList];
                    newList[idx].key = e.target.value;
                    setDeductionList(newList);
                  }}
                />
              </Col>
              <Col span={10}>
                <InputNumber
                  style={{ width: '100%' }}
                  value={item.value}
                  min={0}
                  placeholder="Value ($)"
                  onChange={(val) => {
                    const newList = [...deductionList];
                    newList[idx].value = Number(val);
                    setDeductionList(newList);
                  }}
                />
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setDeductionList([...deductionList, { key: '', value: 0 }])}
            style={{ width: '100%', marginBottom: 24 }}
          >
            Add Custom Deduction Component
          </Button>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsStructureModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save Structure Template
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Compensation Modal */}
      <Modal
        title="Assign Compensation Structure"
        open={isAssignModalOpen}
        onCancel={() => setIsAssignModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignSalary}>
          <Form.Item
            name="employee_id"
            label="Select Employee"
            rules={[{ required: true, message: 'Please select employee!' }]}
          >
            <Select showSearch placeholder="Select target employee...">
              {employees.map(emp => (
                <Option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="structure_id"
            label="Select Salary Structure template"
            rules={[{ required: true, message: 'Please select salary structure!' }]}
          >
            <Select placeholder="Select structure configuration...">
              {structures.map(struct => (
                <Option key={struct.id} value={struct.id}>{struct.name} (${Number(struct.base_salary).toLocaleString()} base)</Option>
              ))}
            </Select>
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Bank Account Details</Text>

          <Form.Item name="bank_name" label="Bank Name">
            <Input placeholder="e.g. Chase Bank" prefix={<BankOutlined />} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="account_number" label="Account Number">
                <Input placeholder="e.g. 123456789" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tax_identifier" label="Tax Identifier / PAN">
                <Input placeholder="e.g. TAX-999-111" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="effective_date"
            label="Effective Date (YYYY-MM-DD)"
            rules={[{ required: true, message: 'Please enter effective date!' }]}
          >
            <Input placeholder="e.g. 2026-06-01" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Assign Compensation
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PayrollWorkspace;
