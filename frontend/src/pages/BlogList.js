import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, Row, Col, Tag, Space, Typography, Skeleton } from 'antd';
import { ClockCircleOutlined, UserOutlined, FolderOutlined } from '@ant-design/icons';
import '../css/blog.css';

const { Title, Text } = Typography;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const BlogList = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(
                    `${API_BASE_URL}/pdf/category`,
                    { 
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        } 
                    }
                );
                const formattedPosts = response.data.map(post => ({
                    ...post,
                    title: post.title.replace(/\.pdf$/i, '')
                }));
                setPosts(formattedPosts);
            } catch (error) {
                console.error('❌ Lỗi khi lấy danh sách bài viết:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPosts();
    }, []);

    if (loading) {
        return (
            <div className="blog-list-container">
                <Row gutter={[16, 16]}>
                    {[1, 2, 3].map(i => (
                        <Col xs={24} sm={12} lg={8} key={i}>
                            <Card>
                                <Skeleton active />
                            </Card>
                        </Col>
                    ))}
                </Row>
            </div>
        );
    }

    return (
        <div className="blog-list-container">
            <div className="blog-list-content">
                <Title level={2} style={{ marginBottom: '24px', textAlign: 'center' }}>
                    Tài Liệu Không Gian Chung
                </Title>
                <Row gutter={[16, 16]}>
                    {posts.map(post => (
                        <Col xs={24} sm={12} lg={8} key={post.id}>
                            <Link to={`/blog/${post.id}`} style={{ textDecoration: 'none' }}>
                                <Card hoverable className="blog-card">
                                    <Title level={4} ellipsis={{ rows: 2 }}>
                                        {post.title}
                                    </Title>
                                    <Text type="secondary" ellipsis={{ rows: 3 }}>
                                        {post.excerpt}
                                    </Text>
                                    <Space direction="vertical" size={12} style={{ width: '100%', marginTop: '12px' }}>
                                        <Space>
                                            <UserOutlined />
                                            <Text>{post.author || 'Không xác định'}</Text>
                                        </Space>
                                        <Space>
                                            <ClockCircleOutlined />
                                            <Text>{post.readingTime} phút đọc</Text>
                                        </Space>
                                        <Space>
                                            <FolderOutlined />
                                            <Text>{post.category}</Text>
                                        </Space>
                                    </Space>
                                </Card>
                            </Link>
                        </Col>
                    ))}
                </Row>
                {posts.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: '48px' }}>
                        <Text type="secondary">Chưa có tài liệu nào</Text>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlogList; 