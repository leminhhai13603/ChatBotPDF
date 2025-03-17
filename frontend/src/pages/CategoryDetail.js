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

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold' 
  },
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  cardContent: {
    flex: 1,
    padding: '24px'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px'
  },
  cardMeta: {
    marginTop: '16px'
  },
  uploadButton: {
    height: '40px',
    borderRadius: '6px',
    fontWeight: 'bold'
  },
  feedbackForm: {
    marginBottom: '24px',
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  }
};

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
        <div style={styles.container}>
            <div style={styles.header}>
                <Space>
                    <Button 
                        type="link" 
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/blog')}
                    >
                        Quay lại
                    </Button>
                    <Title level={2} style={styles.title}>
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
                        style={styles.uploadButton}
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
                    style={{marginBottom: '24px'}}
                />
            )}

            {category === 'hop-thu-gop-y' && (
                <div style={styles.feedbackForm}>
                    <Title level={4}>Gửi góp ý của bạn</Title>
                    <Input.TextArea
                        rows={4}
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="Nhập nội dung góp ý..."
                        style={{ marginBottom: '16px' }}
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
                                style={styles.card}
                                bodyStyle={styles.cardContent}
                            >
                                <Title level={4} style={styles.cardTitle}>
                                    {post.title.replace(/\.(pdf|csv|txt)$/i, '')}
                                </Title>

                                <Paragraph ellipsis={{ rows: 3 }}>
                                    {post.excerpt}
                                </Paragraph>

                                <Space direction="vertical" size={12} style={styles.cardMeta}>
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

                                <div style={{marginTop: 'auto', textAlign: 'right'}}>
                                    <Button 
                                        type="primary"
                                        onClick={() => handleViewDetail(post.id)}
                                    >
                                        Xem chi tiết
                                    </Button>
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