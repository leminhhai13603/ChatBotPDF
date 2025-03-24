import React, { useEffect, useState } from "react";
import { Navbar, Container, Dropdown, Button } from "react-bootstrap";
import { FaUser, FaSignOutAlt, FaCog, FaLock, FaUsersCog, FaHome, FaFolder, FaBook, FaBars } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Link } from "react-router-dom";
import { FaUserCog, FaList, FaBlog } from "react-icons/fa";
import { TableOutlined } from '@ant-design/icons';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const Header = ({ onLogout }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setShowMenu(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;
    
                const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setUser(response.data);
            } catch (error) {
                console.error("Lỗi khi lấy thông tin user:", error);
            }
        };
    
        fetchUserInfo();
    }, []);
    
    // Kiểm tra xem người dùng có quyền xem Project Management không
    const canAccessProjectManagement = () => {
        if (!user || !user.roles) return false;
        
        // Kiểm tra xem user có role NHÂN SỰ, PM hoặc admin không
        return user.roles.some(role => 
            // Thêm admin vào danh sách
            role === "admin" || role === "ADMIN" ||
            role === "NHÂN SỰ" || role === "PM" || 
            role === "NHAN SU" || role === "nhan su" || 
            role === "nhân sự" || role === "pm" ||
            // Nếu role là mã số, có thể cần xét tên role
            (user.rolenames && user.rolenames.some(name => 
                name === "admin" || name === "ADMIN" ||
                name === "NHÂN SỰ" || name === "PM" || 
                name === "NHAN SU" || name === "nhan su" || 
                name === "nhân sự" || name === "pm"
            ))
        );
    };

    const toggleMenu = () => {
        setShowMenu(!showMenu);
    };

    return (
        <Navbar expand="lg" fixed="top" className="header-navbar">
            <Container className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                    {isMobile ? (
                        <Button 
                            variant="light" 
                            className="me-2 menu-toggle" 
                            onClick={toggleMenu}
                        >
                            <FaBars />
                        </Button>
                    ) : null}
                    <Button 
                        variant="light" 
                        className="me-3 home-button" 
                        onClick={() => navigate("/")}
                        title="Về trang chủ"
                    >
                        <FaHome /> {!isMobile && <span className="ms-1">Trang chủ</span>}
                    </Button>
                </div>

                <div className={`header-menu ${showMenu ? 'show' : ''}`}>
                    <Button 
                        variant="light" 
                        className="me-3" 
                        onClick={() => navigate("/blog")}
                        title="Xem tài liệu"
                    >
                        <FaBook /> {!isMobile && <span className="ms-1">Không gian chung</span>}
                    </Button>
                    
                    {/* Chỉ hiển thị nút Project Management nếu người dùng có quyền */}
                    {canAccessProjectManagement() && (
                        <Button 
                            variant="light" 
                            className="me-3" 
                            onClick={() => navigate("/sheets")}
                            title="Quản lý dự án"
                        >
                            <TableOutlined /> {!isMobile && <span className="ms-1">Project Management</span>}
                        </Button>
                    )}
                    
                    <div className="header-title"></div>
                </div>

                <Dropdown className="header-user">
                    <Dropdown.Toggle variant="light" id="user-dropdown">
                        <FaUser /> {!isMobile && (user ? user.fullname : "Người dùng")}
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item onClick={() => navigate("/profile")}>
                            <FaUserCog /> Đổi thông tin cá nhân
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => navigate("/change-password")}>
                            <FaLock /> Đổi mật khẩu
                        </Dropdown.Item>
                        {user?.roles?.includes("admin") && (
                            <>
                                <Dropdown.Item onClick={() => navigate("/manage-users")}>
                                    <FaUsersCog /> Quản lý tài khoản
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => navigate("/manage-categories")}>
                                    <FaFolder /> Quản lý danh mục
                                </Dropdown.Item>
                            </>
                        )}
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={onLogout} className="text-danger">
                            <FaSignOutAlt /> Đăng Xuất
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </Container>
        </Navbar>
    );
};

export default Header;
