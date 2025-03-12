import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Space, Button, Skeleton, Upload, message } from 'antd';
import { 
    UserOutlined, 
    ClockCircleOutlined, 
    ArrowLeftOutlined,
    FileTextOutlined,
    UploadOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import 'moment/locale/vi';

const { Title, Text } = Typography;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const CategoryDetail = () => {
    const { category } = useParams();
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const getCategoryWithAccents = (categoryParam) => {
        const categoryMap = {
            'dinh-huong-tong-the': 'Định hướng tổng thể',
            // Thêm các mapping khác nếu cần
        };
        return categoryMap[categoryParam] || categoryParam;
    };

    const fetchPosts = async (categoryWithAccents) => {
        try {
            const token = localStorage.getItem('token');
            console.log("Fetching with category:", categoryWithAccents); 
            
            const response = await axios.get(
                `${API_BASE_URL}/categories/khong-gian-chung/sub/${encodeURIComponent(categoryWithAccents)}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setPosts(response.data);
        } catch (error) {
            console.error('❌ Lỗi khi lấy danh sách tài liệu:', error);
            message.error('Không thể tải danh sách tài liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const categoryWithAccents = getCategoryWithAccents(category);
        fetchPosts(categoryWithAccents);
    }, [category]);

    const handleUpload = async (file) => {
        if (!file) {
            message.error("Vui lòng chọn file!");
            return false;
        }

        const fileType = file.type;
        const fileName = file.name.toLowerCase();

        if (!(fileType === "application/pdf" || 
            fileType === "text/csv" || 
            fileName.endsWith('.csv'))) {
            message.error("Vui lòng chọn file PDF hoặc CSV!");
            return false;
        }

        setUploading(true);
        setError("");
        
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("originalFileName", file.name);
            formData.append("subCategory", getCategoryWithAccents(category));

            const token = localStorage.getItem("token");
            const response = await axios.post(
                `${API_BASE_URL}/categories/khong-gian-chung/upload`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            console.log("✅ Upload thành công:", response.data);
            message.success("Upload file thành công!");
            
            const categoryWithAccents = getCategoryWithAccents(category);
            fetchPosts(categoryWithAccents);
        } catch (error) {
            console.error("❌ Lỗi khi upload:", error);
            const errorMessage = error.response?.data?.error || "Lỗi khi upload file!";
            message.error(errorMessage);
            setError(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const handleViewDetail = (postId) => {
        const categoryWithAccents = getCategoryWithAccents(category);
        navigate(`/blog/${postId}`, {
            state: { 
                fromCategory: true,
                category: categoryWithAccents,
                categoryNoAccent: category
            }
        });
    };

    return (
        <div className="blog-list-container">
            <div className="blog-list-content">
                <Space className="category-header">
                    <div className="left-section">
                        <Button 
                            type="link" 
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/blog')}
                        >
                            Quay lại
                        </Button>
                        <Title level={2}>{getCategoryWithAccents(category)}</Title>
                    </div>
                    <Upload
                        accept=".pdf,.csv"
                        showUploadList={false}
                        beforeUpload={handleUpload}
                        disabled={uploading}
                    >
                        <Button 
                            type="primary" 
                            icon={<UploadOutlined />}
                            loading={uploading}
                        >
                            {uploading ? 'Đang upload...' : 'Thêm tài liệu mới'}
                        </Button>
                    </Upload>
                </Space>

                {error && <div className="alert alert-danger">{error}</div>}

                {loading ? (
                    <Row gutter={[16, 16]}>
                        {[1, 2, 3].map(i => (
                            <Col xs={24} sm={12} lg={8} key={i}>
                                <Card>
                                    <Skeleton active />
                                </Card>
                            </Col>
                        ))}
                    </Row>
                ) : (
                    <>
                        <Row gutter={[16, 16]}>
                            {posts.map(post => (
                                <Col xs={24} sm={12} lg={8} key={post.id}>
                                    <Card 
                                        hoverable 
                                        className="blog-card"
                                    >
                                        <div className="blog-card-content">
                                            <Title level={4} ellipsis={{ rows: 2 }}>
                                                {post.title.replace(/\.(pdf|csv)$/i, '')}
                                            </Title>
                                            
                                            <div className="blog-card-excerpt">
                                                {post.excerpt}
                                            </div>

                                            <Space direction="vertical" size={12} className="blog-card-meta">
                                                <Space>
                                                    <UserOutlined />
                                                    <Text>{post.author || 'Không xác định'}</Text>
                                                </Space>
                                                <Space>
                                                    <ClockCircleOutlined />
                                                    <Text>{moment(post.uploadedAt).fromNow()}</Text>
                                                </Space>
                                                <Space>
                                                    <FileTextOutlined />
                                                    <Text>
                                                        {post.file_type?.toUpperCase() || 'PDF'} - {post.readingTime} phút đọc
                                                    </Text>
                                                </Space>
                                            </Space>
                                        </div>
                                        <div className="blog-card-actions">
                                            <Button 
                                                type="link" 
                                                onClick={() => handleViewDetail(post.id)}
                                            >
                                                Xem chi tiết
                                            </Button>
                                        </div>
                                    </Card>
                                </Col>
                            ))}
                        </Row>

                        {posts.length === 0 && (
                            <div className="empty-state">
                                <Text type="secondary">
                                    Chưa có tài liệu nào trong danh mục này
                                </Text>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CategoryDetail; 