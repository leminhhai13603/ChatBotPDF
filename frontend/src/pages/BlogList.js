import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography } from 'antd';
import { 
    CompassOutlined,
    SafetyCertificateOutlined,
    SecurityScanOutlined,
    StarOutlined,
    RocketOutlined,
    TeamOutlined,
    TrophyOutlined,
    BookOutlined,
    MessageOutlined,
    ReadOutlined
} from '@ant-design/icons';
import '../css/blog.css';

const { Title } = Typography;

const FIXED_CATEGORIES = [
    {
        name: 'Định hướng tổng thể',
        icon: <CompassOutlined />,
        color: '#1890ff'
    },
    {
        name: 'Nội quy và cam kết bảo mật',
        icon: <SafetyCertificateOutlined />,
        color: '#52c41a'
    },
    {
        name: 'Bảo mật',
        icon: <SecurityScanOutlined />,
        color: '#722ed1'
    },
    {
        name: 'Gương mặt nổi bật',
        icon: <StarOutlined />,
        color: '#faad14'
    },
    {
        name: 'Chiến lược',
        icon: <RocketOutlined />,
        color: '#eb2f96'
    },
    {
        name: 'Danh bạ nội bộ & giới thiệu nhân sự',
        icon: <TeamOutlined />,
        color: '#13c2c2'
    },
    {
        name: 'Những cột mốc và thành tựu',
        icon: <TrophyOutlined />,
        color: '#fa8c16'
    },
    {
        name: 'Câu chuyện người DK - Blog nội bộ',
        icon: <BookOutlined />,
        color: '#2f54eb'
    },
    {
        name: 'Hộp thư góp ý',
        icon: <MessageOutlined />,
        color: '#f5222d'
    },
    {
        name: 'Tài liệu đào tạo',
        icon: <ReadOutlined />,
        color: '#a0d911'
    }
];

const BlogList = () => {
    const navigate = useNavigate();

    const handleCategoryClick = (category) => {
        navigate(`/blog/category/${encodeURIComponent(category)}`);
    };

    return (
        <div className="blog-list-container">
            <div className="blog-list-content">
                <div className="main-title">
                    <Title level={1}>Không Gian Chung</Title>
                </div>

                <Row gutter={[24, 24]}>
                    {FIXED_CATEGORIES.map((category, index) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={index}>
                            <Card 
                                hoverable
                                className="category-card"
                                onClick={() => handleCategoryClick(category.name)}
                            >
                                <div className="category-icon" style={{ color: category.color }}>
                                    {category.icon}
                                </div>
                                <Title level={4} className="category-title">
                                    {category.name}
                                </Title>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </div>
        </div>
    );
};

export default BlogList; 