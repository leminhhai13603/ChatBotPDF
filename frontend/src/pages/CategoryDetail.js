import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Space, Button, Skeleton, Upload, message, Alert, Empty, Input } from 'antd';
import { 
    UserOutlined, 
    ClockCircleOutlined, 
    ArrowLeftOutlined,
    FileTextOutlined,
    UploadOutlined,
    CalendarOutlined,
    Divider
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import 'moment/locale/vi';

const { Title, Text, Paragraph } = Typography;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const CategoryDetail = () => {
    const { category } = useParams();
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [feedback, setFeedback] = useState('');

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
            
            if (category === 'hop-thu-gop-y') {
                formData.append("isAnonymous", "true");
            }

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

    const handleSubmitFeedback = async () => {
        if (!feedback.trim()) {
            message.error('Vui lòng nhập nội dung góp ý!');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            const blob = new Blob([feedback], { type: 'text/plain' });
            formData.append('file', blob, `gop-y-${moment().format('YYYY-MM-DD-HH-mm')}.txt`);
            formData.append('subCategory', getCategoryWithAccents(category));
            formData.append("isAnonymous", "true");

            await axios.post(
                `${API_BASE_URL}/categories/khong-gian-chung/upload`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            message.success('Gửi góp ý thành công!');
            setFeedback('');
            fetchPosts(getCategoryWithAccents(category));
        } catch (error) {
            console.error('❌ Lỗi khi gửi góp ý:', error);
            message.error('Không thể gửi góp ý. Vui lòng thử lại sau!');
        }
    };

    const isAnonymous = category === 'hop-thu-gop-y';

    return (
        <div className="category-detail-container">
            <div className="category-detail-header">
                <Space>
                    <Button 
                        type="link" 
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/blog')}
                        className="back-button"
                    >
                        Quay lại
                    </Button>
                    <Title level={2} className="category-title">
                        {getCategoryWithAccents(category)}
                    </Title>
                </Space>

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
                        className="upload-button"
                    >
                        {uploading ? 'Đang upload...' : 'Thêm tài liệu mới'}
                    </Button>
                </Upload>
            </div>

            {error && (
                <Alert
                    message="Lỗi"
                    description={error}
                    type="error"
                    showIcon
                    className="error-alert"
                />
            )}

            {category === 'hop-thu-gop-y' && (
                <div className="feedback-form">
                    <Title level={4}>Gửi góp ý của bạn</Title>
                    <Input.TextArea
                        rows={4}
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="Nhập nội dung góp ý..."
                        className="feedback-input"
                    />
                    <Button 
                        type="primary"
                        onClick={handleSubmitFeedback}
                        loading={uploading}
                    >
                        Gửi góp ý
                    </Button>
                </div>
            )}

            <Row gutter={[24, 24]}>
                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <Col xs={24} sm={12} lg={8} key={i}>
                            <Card>
                                <Skeleton active />
                            </Card>
                        </Col>
                    ))
                ) : posts.length > 0 ? (
                    posts.map(post => (
                        <Col xs={24} sm={12} lg={8} key={post.id}>
                            <Card 
                                hoverable
                                className="post-card"
                            >
                                <div className="post-card-content">
                                    <Title level={4} className="post-title">
                                        {post.title.replace(/\.(pdf|csv|txt)$/i, '')}
                                    </Title>

                                    <Paragraph ellipsis={{ rows: 3 }} className="post-excerpt">
                                        {post.excerpt}
                                    </Paragraph>

                                    <Space direction="vertical" size={12} className="post-meta">
                                        {!isAnonymous && (
                                            <Space>
                                                <UserOutlined />
                                                <Text>{post.author || 'Không xác định'}</Text>
                                            </Space>
                                        )}
                                        <Space>
                                            <ClockCircleOutlined />
                                            <Text>{moment(post.uploadedAt).format('LL')}</Text>
                                        </Space>
                                        <Space>
                                            <FileTextOutlined />
                                            <Text>
                                                {post.file_type?.toUpperCase() || 'TXT'} - {post.readingTime} phút đọc
                                            </Text>
                                        </Space>
                                    </Space>

                                    <div className="post-actions">
                                        <Button 
                                            type="primary"
                                            onClick={() => handleViewDetail(post.id)}
                                        >
                                            Xem chi tiết
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </Col>
                    ))
                ) : (
                    <Col span={24}>
                        <Empty
                            description="Chưa có tài liệu nào trong danh mục này"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                    </Col>
                )}
            </Row>
        </div>
    );
};

export default CategoryDetail; 