import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Avatar, Button, Form, Input, Select, Space,
  Typography, Divider, Tag, Tooltip, Empty, List, message
} from 'antd';
import {
  SendOutlined,
  LikeOutlined,
  CommentOutlined,
  PushpinOutlined,
  SmileOutlined,
  BulbOutlined,
  GiftOutlined,
  SoundOutlined,
  UserOutlined,
  PlusOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Post, Comment, Employee } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export const SocialFeed: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'HR';
  const isManager = user?.role === 'Manager';
  const canPin = isAdminOrHR || isManager;

  const [posts, setPosts] = useState<Post[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Post Creator States
  const [postType, setPostType] = useState<string>('General');
  const [showPollCreator, setShowPollCreator] = useState<boolean>(false);
  const [pollQuestion, setPollQuestion] = useState<string>('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [postForm] = Form.useForm();

  // Comments state mapped by postId
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [visibleComments, setVisibleComments] = useState<Record<number, boolean>>({});
  const [newCommentText, setNewCommentText] = useState<Record<number, string>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const postsRes = await api.getPosts();
      setPosts(postsRes);

      const empsRes = await api.getEmployees({ limit: 100 });
      setEmployees(empsRes.data || []);
    } catch (err) {
      console.error('Error loading social feed:', err);
      message.error('Failed to load social feed posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePost = async (values: any) => {
    try {
      const payload: any = {
        content: values.content,
        type: postType,
        attachments: []
      };

      if (showPollCreator && pollQuestion.trim()) {
        const activeOptions = pollOptions.filter(o => o.trim() !== '');
        if (activeOptions.length < 2) {
          message.error('Please specify at least 2 poll options.');
          return;
        }
        payload.poll = {
          question: pollQuestion,
          options: activeOptions
        };
      }

      await api.createPost(payload);
      message.success('Social post published successfully.');
      postForm.resetFields();
      setPostType('General');
      setShowPollCreator(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      loadData();
    } catch (err) {
      console.error('Error creating post:', err);
      message.error('Failed to publish post.');
    }
  };

  const handleReact = async (postId: number, currentReaction: string | null, targetReaction: string) => {
    try {
      const nextReaction = currentReaction === targetReaction ? null : targetReaction;
      await api.reactPost(postId, { reaction_type: nextReaction });
      loadData();
    } catch (err) {
      console.error('Error updating reaction:', err);
    }
  };

  const handlePin = async (postId: number, currentPinned: boolean) => {
    try {
      await api.pinPost(postId, { is_pinned: !currentPinned });
      message.success(currentPinned ? 'Post unpinned.' : 'Post pinned to top.');
      loadData();
    } catch (err) {
      console.error('Error pinning post:', err);
    }
  };

  const handlePollVote = async (pollId: number, optionIdx: number) => {
    try {
      await api.votePoll(pollId, { option_index: optionIdx });
      message.success('Vote submitted successfully.');
      loadData();
    } catch (err) {
      console.error('Error voting on poll:', err);
    }
  };

  const toggleComments = async (postId: number) => {
    const isVisible = !visibleComments[postId];
    setVisibleComments(prev => ({ ...prev, [postId]: isVisible }));

    if (isVisible && !commentsMap[postId]) {
      try {
        const comments = await api.getComments(postId);
        setCommentsMap(prev => ({ ...prev, [postId]: comments }));
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    }
  };

  const handleSubmitComment = async (postId: number) => {
    const text = newCommentText[postId];
    if (!text || !text.trim()) return;

    try {
      const comm = await api.createComment(postId, { content: text });
      setCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), comm]
      }));
      setNewCommentText(prev => ({ ...prev, [postId]: '' }));
      loadData();
    } catch (err) {
      console.error('Error adding comment:', err);
      message.error('Failed to publish comment.');
    }
  };

  const getPostTypeTag = (type: string) => {
    switch (type) {
      case 'Announcement':
        return <Tag color="error" icon={<SoundOutlined />}>Announcement</Tag>;
      case 'Achievement':
        return <Tag color="success" icon={<BulbOutlined />}>Achievement</Tag>;
      case 'Birthday':
        return <Tag color="magenta" icon={<GiftOutlined />}>Birthday celebration</Tag>;
      case 'Anniversary':
        return <Tag color="purple" icon={<SmileOutlined />}>Work Anniversary</Tag>;
      default:
        return null;
    }
  };

  const getAuthorName = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return 'Employee';
    const emp = employees.find(e => e.id === post.employee_id);
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Team Member';
  };

  const getAuthorRole = (postId: number) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return '';
    const emp = employees.find(e => e.id === post.employee_id);
    return emp ? `${emp.role} - ${emp.department?.name || 'HRMS'}` : '';
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Row gutter={24}>
        {/* Left column: Profile Summary widget */}
        <Col xs={24} md={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center', marginBottom: 24 }}>
            <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: 'var(--primary-color)', marginBottom: 16 }} />
            <Title level={4} style={{ margin: 0 }}>{user?.first_name} {user?.last_name}</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>{user?.role}</Text>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <Text type="secondary">My Department:</Text>
                <Text strong>{user?.department?.name || 'N/A'}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <Text type="secondary">Member Since:</Text>
                <Text strong>{user?.joining_date || 'N/A'}</Text>
              </div>
            </div>
          </Card>
        </Col>

        {/* Middle column: Post Creator & Feed */}
        <Col xs={24} md={12}>
          {/* Post Creator Card */}
          <Card style={{ borderRadius: 12, marginBottom: 24 }} bodyStyle={{ padding: 20 }}>
            <Form form={postForm} onFinish={handleCreatePost} layout="vertical">
              <Form.Item name="content" rules={[{ required: true, message: 'Share something with your team!' }]}>
                <TextArea
                  rows={3}
                  placeholder="Share a milestone, write an announcement, or run a team poll..."
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>

              {showPollCreator && (
                <Card style={{ backgroundColor: '#F7F8FA', border: 'none', marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>Create Team Poll</Text>
                  <Input
                    placeholder="Enter poll question..."
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  {pollOptions.map((opt, oIdx) => (
                    <Input
                      key={`opt-${oIdx}`}
                      placeholder={`Option ${oIdx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const nextOpts = [...pollOptions];
                        nextOpts[oIdx] = e.target.value;
                        setPollOptions(nextOpts);
                      }}
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setPollOptions([...pollOptions, ''])}
                  >
                    Add Option
                  </Button>
                </Card>
              )}

              <Row justify="space-between" align="middle">
                <Col>
                  <Space>
                    <Select
                      value={postType}
                      onChange={(val) => setPostType(val)}
                      style={{ width: 150 }}
                      size="small"
                    >
                      <Option value="General">General</Option>
                      <Option value="Announcement">Announcement</Option>
                      <Option value="Achievement">Achievement</Option>
                      <Option value="Birthday">Birthday</Option>
                      <Option value="Anniversary">Anniversary</Option>
                    </Select>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setShowPollCreator(!showPollCreator)}
                    >
                      {showPollCreator ? 'Remove Poll' : 'Add Poll'}
                    </Button>
                  </Space>
                </Col>
                <Col>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SendOutlined />}
                  >
                    Post
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* Social Feed Stream */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading social feed...</div>
          ) : posts.length === 0 ? (
            <Empty description="No social updates published yet. Be the first to share!" />
          ) : (
            posts.map(post => {
              const isLikedByMe = post.user_reaction === 'Like';
              const isCelebrateByMe = post.user_reaction === 'Celebrate';
              const comments = commentsMap[post.id] || [];

              return (
                <Card
                  key={post.id}
                  style={{
                    borderRadius: 12,
                    marginBottom: 20,
                    border: post.is_pinned ? '1px solid var(--primary-color)' : undefined
                  }}
                  bodyStyle={{ padding: 20 }}
                >
                  {/* Post Header */}
                  <Row justify="space-between" align="top" style={{ marginBottom: 12 }}>
                    <Col>
                      <Space size={12}>
                        <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#64748B' }} />
                        <div>
                          <Text strong style={{ display: 'block' }}>
                            {getAuthorName(post.id)}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {getAuthorRole(post.id)} • {new Date(post.created_at || '').toLocaleDateString()}
                          </Text>
                        </div>
                      </Space>
                    </Col>
                    <Col style={{ textAlign: 'right' }}>
                      <Space>
                        {getPostTypeTag(post.type)}
                        {post.is_pinned && <Tag color="success" icon={<PushpinOutlined />}>Pinned</Tag>}
                        {canPin && (
                          <Tooltip title={post.is_pinned ? 'Unpin post' : 'Pin post to top'}>
                            <Button
                              type="text"
                              shape="circle"
                              icon={<PushpinOutlined style={{ color: post.is_pinned ? 'var(--primary-color)' : '#94A3B8' }} />}
                              onClick={() => handlePin(post.id, !!post.is_pinned)}
                            />
                          </Tooltip>
                        )}
                      </Space>
                    </Col>
                  </Row>

                  {/* Post Content */}
                  <Paragraph style={{ fontSize: 15, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
                    {post.content}
                  </Paragraph>

                  {/* Dynamic Interactive Poll Element */}
                  {post.poll && (
                    <Card
                      style={{ backgroundColor: '#F7F8FA', border: 'none', borderRadius: 8, marginBottom: 16 }}
                      bodyStyle={{ padding: 16 }}
                    >
                      <Text strong style={{ display: 'block', marginBottom: 12 }}>
                        {post.poll.question}
                      </Text>
                      {post.poll.options.map((opt, idx) => {
                        const totalVotes = Object.values(post.poll?.votes || {}).reduce((sum, val) => sum + Number(val), 0);
                        const optVotes = post.poll?.votes?.[idx] || 0;
                        const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                        const hasVoted = post.poll?.user_vote !== null;

                        return (
                          <div key={idx} style={{ marginBottom: 10 }}>
                            {hasVoted ? (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text>
                                    {opt} {post.poll?.user_vote === idx && <CheckCircleOutlined style={{ color: 'var(--success-color)', marginLeft: 4 }} />}
                                  </Text>
                                  <Text>{percentage}% ({optVotes})</Text>
                                </div>
                                <div style={{ height: 8, backgroundColor: '#E4E7EC', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: 'var(--primary-color)' }} />
                                </div>
                              </div>
                            ) : (
                              <Button
                                block
                                style={{ textAlign: 'left', borderRadius: 6 }}
                                onClick={() => handlePollVote(post.poll!.id, idx)}
                              >
                                {opt}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
                        Total Poll Votes: {Object.values(post.poll?.votes || {}).reduce((sum, val) => sum + Number(val), 0)}
                      </Text>
                    </Card>
                  )}

                  <Divider style={{ margin: '12px 0' }} />

                  {/* Post Footer Actions */}
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Space size={16}>
                        <Button
                          type="text"
                          icon={<LikeOutlined style={{ color: isLikedByMe ? 'var(--primary-color)' : undefined }} />}
                          onClick={() => handleReact(post.id, post.user_reaction || null, 'Like')}
                        >
                          Like ({post.reactions?.['Like'] || 0})
                        </Button>
                        <Button
                          type="text"
                          icon={<SmileOutlined style={{ color: isCelebrateByMe ? 'var(--warning-color)' : undefined }} />}
                          onClick={() => handleReact(post.id, post.user_reaction || null, 'Celebrate')}
                        >
                          Celebrate ({post.reactions?.['Celebrate'] || 0})
                        </Button>
                        <Button
                          type="text"
                          icon={<CommentOutlined />}
                          onClick={() => toggleComments(post.id)}
                        >
                          Comment ({post.comments_count || 0})
                        </Button>
                      </Space>
                    </Col>
                  </Row>

                  {/* Comments Section */}
                  {visibleComments[post.id] && (
                    <div style={{ marginTop: 16, borderTop: '1px solid #E4E7EC', paddingTop: 16 }}>
                      <List
                        dataSource={comments}
                        itemLayout="horizontal"
                        locale={{ emptyText: 'No comments yet. Write yours!' }}
                        renderItem={comm => (
                          <List.Item style={{ padding: '8px 0' }}>
                            <List.Item.Meta
                              avatar={<Avatar size="small" icon={<UserOutlined />} />}
                              title={
                                <Space>
                                  <Text strong>{comm.employee_name || 'Team Member'}</Text>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {new Date(comm.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </Space>
                              }
                              description={<Paragraph style={{ margin: 0, color: '#334155' }}>{comm.content}</Paragraph>}
                            />
                          </List.Item>
                        )}
                      />
                      <Row gutter={8} style={{ marginTop: 12 }}>
                        <Col span={20}>
                          <Input
                            placeholder="Type a comment..."
                            value={newCommentText[post.id] || ''}
                            onChange={(e) => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onPressEnter={() => handleSubmitComment(post.id)}
                          />
                        </Col>
                        <Col span={4}>
                          <Button
                            type="primary"
                            block
                            onClick={() => handleSubmitComment(post.id)}
                          >
                            Send
                          </Button>
                        </Col>
                      </Row>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </Col>

        {/* Right column: Announcements widget */}
        <Col xs={24} md={6}>
          <Card title="Company Announcements" style={{ borderRadius: 12, marginBottom: 24 }}>
            <List
              dataSource={posts.filter(p => p.type === 'Announcement')}
              locale={{ emptyText: 'No recent announcements.' }}
              renderItem={ann => (
                <List.Item style={{ padding: '12px 0' }}>
                  <Space direction="vertical" size={2}>
                    <Text strong style={{ color: '#E5484D' }}>{ann.content.slice(0, 60)}...</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(ann.created_at || '').toLocaleDateString()}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          <Card title="Birthday & Anniversaries" style={{ borderRadius: 12 }}>
            <List
              dataSource={posts.filter(p => p.type === 'Birthday' || p.type === 'Anniversary')}
              locale={{ emptyText: 'No recent celebrations.' }}
              renderItem={post => (
                <List.Item style={{ padding: '12px 0' }}>
                  <Space size={8}>
                    {post.type === 'Birthday' ? <GiftOutlined style={{ color: '#EC4899' }} /> : <SmileOutlined style={{ color: '#8B5CF6' }} />}
                    <div>
                      <Text style={{ fontSize: 13 }}>{post.content.slice(0, 80)}...</Text>
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SocialFeed;
