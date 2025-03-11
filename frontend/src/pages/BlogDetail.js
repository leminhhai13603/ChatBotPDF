import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Typography, Space, Tag, Divider, Skeleton, Card, Button, message } from 'antd';
import { 
    UserOutlined, 
    ClockCircleOutlined, 
    CalendarOutlined,
    ArrowLeftOutlined,
    FileTextOutlined 
} from '@ant-design/icons';
import moment from 'moment';
import 'moment/locale/vi';

const { Title, Text, Paragraph } = Typography;

moment.locale('vi');

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const BlogDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("Current location:", location);
        console.log("Location state:", location.state);
        console.log("Category from state:", location.state?.category);
    }, [location]);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(
                    `${API_BASE_URL}/pdf/details/${id}`,
                    { 
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        } 
                    }
                );
                setPost(response.data);
            } catch (error) {
                console.error('❌ Lỗi khi lấy chi tiết tài liệu:', error);
                message.error('Không thể tải tài liệu. Vui lòng thử lại sau.');
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [id]);

    const formatContent = (content) => {
        if (!content) return [];

        const sections = [];
        let currentSection = '';
        let currentTitle = '';

        content.split('\n').forEach(line => {
            // Kiểm tra xem dòng có phải là tiêu đề không
            if (line.match(/^(#{1,6}|\d+\.|\d+\.\d+|[IVX]+\.)\s+/)) {
                if (currentTitle) {
                    sections.push({
                        title: currentTitle,
                        content: currentSection.trim()
                    });
                }
                currentTitle = line;
                currentSection = '';
            } else {
                currentSection += line + '\n';
            }
        });

        if (currentTitle || currentSection) {
            sections.push({
                title: currentTitle,
                content: currentSection.trim()
            });
        }

        return sections;
    };

    const handleBack = () => {
        if (location.state?.fromCategory) {
            const categoryNoAccent = location.state.categoryNoAccent;
            navigate(`/blog/category/${categoryNoAccent}`);
        } else {
            navigate('/blog');
        }
    };

    if (loading) {
        return (
            <div className="blog-detail-container">
                <Card>
                    <Skeleton active paragraph={{ rows: 10 }} />
                </Card>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="blog-detail-container">
                <Card>
                    <Title level={4}>Không tìm thấy tài liệu</Title>
                    <Button type="primary" onClick={handleBack} icon={<ArrowLeftOutlined />}>
                        Quay lại
                    </Button>
                </Card>
            </div>
        );
    }

    const sections = formatContent(post.content);

    return (
        <div className="blog-detail-container">
            <Card>
                <Button 
                    type="link" 
                    onClick={handleBack}
                    icon={<ArrowLeftOutlined />}
                    style={{ marginBottom: 16, padding: 0 }}
                >
                    Quay lại danh sách
                </Button>

                <Title>{post.title}</Title>
                
                <Space split={<Divider type="vertical" />} style={{ marginBottom: 24 }}>
                    <Space>
                        <UserOutlined />
                        <Text>{post.author || 'Không xác định'}</Text>
                    </Space>
                    <Space>
                        <CalendarOutlined />
                        <Text>{moment(post.uploadedAt).format('LL')}</Text>
                    </Space>
                    <Space>
                        <ClockCircleOutlined />
                        <Text>{post.readingTime} phút đọc</Text>
                    </Space>
                </Space>

                {post.keywords?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        {post.keywords.map(keyword => (
                            <Tag key={keyword} color="blue" style={{ margin: '4px' }}>
                                {keyword}
                            </Tag>
                        ))}
                    </div>
                )}

                <Divider />

                {sections.length > 1 && (
                    <>
                        <Card size="small" className="table-of-contents">
                            <Title level={4}>
                                <FileTextOutlined /> Mục lục
                            </Title>
                            <ul className="toc-list">
                                {sections.map((section, index) => (
                                    <li key={index}>
                                        <a href={`#section-${index}`}>
                                            {section.title || `Phần ${index + 1}`}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                        <Divider />
                    </>
                )}

                <div className="blog-content">
                    {sections.map((section, index) => (
                        <div key={index} id={`section-${index}`} className="content-section">
                            {section.title && (
                                <Title level={3}>{section.title}</Title>
                            )}
                            <Paragraph>
                                {section.content.split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        <br />
                                    </React.Fragment>
                                ))}
                            </Paragraph>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default BlogDetail; 